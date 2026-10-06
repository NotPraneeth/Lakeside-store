import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Cart } from "@/models/Cart";
import { Product } from "@/models/Product";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();

  const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(user.id) }).lean<{
    items: { productId: unknown; quantity: number }[];
  } | null>();

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ items: [], subtotal: 0, count: 0 });
  }

  const ids = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items = cart.items
    .map((i) => {
      const p = byId.get(String(i.productId)) as
        | { _id: unknown; name: string; price: number; currency: string; imageUrl: string; stock: number; isActive: boolean }
        | undefined;
      if (!p || !p.isActive) return null;
      return {
        productId: String(i.productId),
        name: p.name,
        unitPrice: p.price,
        currency: p.currency,
        imageUrl: p.imageUrl,
        stock: p.stock,
        quantity: i.quantity,
        lineTotal: p.price * i.quantity,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((s, i) => s + (i?.lineTotal ?? 0), 0);
  const count = items.reduce((s, i) => s + (i?.quantity ?? 0), 0);

  return NextResponse.json({ items, subtotal, count });
}
