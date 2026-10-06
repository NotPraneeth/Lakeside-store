import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { cartItemSchema, cartUpdateSchema } from "@/lib/validators";
import { Cart } from "@/models/Cart";
import { Product } from "@/models/Product";

async function loadProduct(productId: string) {
  if (!mongoose.Types.ObjectId.isValid(productId)) return null;
  await connectDb();
  return Product.findOne({ _id: productId, isActive: true }).lean<{
    _id: unknown;
    stock: number;
  } | null>();
}

// POST /api/cart/items — add { productId, quantity }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = cartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const product = await loadProduct(parsed.data.productId);
  if (!product) return NextResponse.json({ error: "Product not available" }, { status: 404 });
  if (product.stock <= 0) return NextResponse.json({ error: "Out of stock" }, { status: 400 });

  const userId = new mongoose.Types.ObjectId(user.id);
  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, items: [] } },
    { upsert: true, new: true }
  ).lean<{ items: { productId: unknown; quantity: number }[] } | null>();

  const existing = cart?.items.find((i) => String(i.productId) === parsed.data.productId);
  const newQty = (existing?.quantity ?? 0) + parsed.data.quantity;
  if (newQty > product.stock) {
    return NextResponse.json({ error: `Only ${product.stock} in stock` }, { status: 400 });
  }

  if (existing) {
    await Cart.updateOne(
      { userId, "items.productId": new mongoose.Types.ObjectId(parsed.data.productId) },
      { $set: { "items.$.quantity": newQty } }
    );
  } else {
    await Cart.updateOne(
      { userId },
      { $push: { items: { productId: new mongoose.Types.ObjectId(parsed.data.productId), quantity: parsed.data.quantity } } }
    );
  }
  return NextResponse.json({ ok: true, quantity: newQty });
}

// PATCH /api/cart/items — change quantity (0 removes it)
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = cartUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const userId = new mongoose.Types.ObjectId(user.id);
  if (parsed.data.quantity === 0) {
    await Cart.updateOne({ userId }, { $pull: { items: { productId: new mongoose.Types.ObjectId(parsed.data.productId) } } });
    return NextResponse.json({ ok: true, removed: true });
  }

  const product = await loadProduct(parsed.data.productId);
  if (!product) return NextResponse.json({ error: "Product not available" }, { status: 404 });
  if (parsed.data.quantity > product.stock) {
    return NextResponse.json({ error: `Only ${product.stock} in stock` }, { status: 400 });
  }

  const res = await Cart.updateOne(
    { userId, "items.productId": new mongoose.Types.ObjectId(parsed.data.productId) },
    { $set: { "items.$.quantity": parsed.data.quantity } }
  );
  if (res.matchedCount === 0) return NextResponse.json({ error: "Item not in cart" }, { status: 404 });
  return NextResponse.json({ ok: true, quantity: parsed.data.quantity });
}

// DELETE /api/cart/items?productId= — remove an item
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId") ?? "";
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }
  await connectDb();
  await Cart.updateOne(
    { userId: new mongoose.Types.ObjectId(user.id) },
    { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } }
  );
  return NextResponse.json({ ok: true });
}
