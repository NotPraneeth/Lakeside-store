import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Cart } from "@/models/Cart";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { User } from "@/models/User";

// POST /api/orders — checkout: turn the cart into an order.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();

  const userId = new mongoose.Types.ObjectId(user.id);
  const cart = await Cart.findOne({ userId }).lean<{
    items: { productId: unknown; quantity: number }[];
  } | null>();

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const ids = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  // Reject inactive / missing products before touching stock.
  for (const item of cart.items) {
    const p = byId.get(String(item.productId)) as { isActive: boolean } | undefined;
    if (!p || !p.isActive) {
      return NextResponse.json({ error: "A product in your cart is no longer available" }, { status: 400 });
    }
  }

  // Reduce stock atomically per item. Roll back already-reduced ones on failure.
  const reduced: { id: unknown; qty: number }[] = [];
  for (const item of cart.items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    ).lean();
    if (!updated) {
      for (const r of reduced) {
        await Product.updateOne({ _id: r.id }, { $inc: { stock: r.qty } });
      }
      return NextResponse.json(
        { error: "Not enough stock for an item in your cart" },
        { status: 400 }
      );
    }
    reduced.push({ id: item.productId, qty: item.quantity });
  }

  // Build order items with snapshots (name/category/unitPrice) from live prices.
  const orderItems = cart.items.map((item) => {
    const p = byId.get(String(item.productId)) as {
      _id: unknown;
      name: string;
      category: string;
      price: number;
    };
    return {
      productId: p._id as mongoose.Types.ObjectId,
      name: p.name,
      category: p.category,
      unitPrice: p.price,
      quantity: item.quantity,
    };
  });
  const subtotal = orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const dbUser = await User.findById(userId).lean<{
    address?: { line1?: string; city?: string; state?: string; postalCode?: string; country?: string };
  } | null>();

  const order = await Order.create({
    userId,
    items: orderItems,
    subtotal,
    total: subtotal,
    status: "placed",
    shippingAddress: dbUser?.address ?? {},
  });

  await Cart.updateOne({ userId }, { $set: { items: [] } });

  return NextResponse.json({ orderId: String(order._id) }, { status: 201 });
}

// GET /api/orders — purchase history, newest first (own orders only).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();

  const orders = await Order.find({ userId: new mongoose.Types.ObjectId(user.id) })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: String(o._id),
      items: (o.items as { name: string; quantity: number; unitPrice: number }[]).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      itemCount: (o.items as unknown[]).length,
      total: o.total as number,
      status: o.status as string,
      createdAt: (o as unknown as { createdAt: Date }).createdAt,
    })),
  });
}
