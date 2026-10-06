import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Order } from "@/models/Order";

// GET /api/profile/summary — the shopper's own shopping summary (own orders only).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();

  const orders = await Order.find({
    userId: new mongoose.Types.ObjectId(user.id),
    status: "placed",
  }).lean<{
    total: number;
    createdAt: Date;
    items: { category: string; unitPrice: number; quantity: number }[];
  }[]>();

  const totalSpent = orders.reduce((s, o) => s + o.total, 0);
  const byCat = new Map<string, { spend: number; units: number }>();
  const byMonth = new Map<string, number>();
  for (const o of orders) {
    const m = `${o.createdAt.getUTCFullYear()}-${String(o.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(m, (byMonth.get(m) ?? 0) + o.total);
    for (const i of o.items) {
      const e = byCat.get(i.category) ?? { spend: 0, units: 0 };
      e.spend += i.unitPrice * i.quantity;
      e.units += i.quantity;
      byCat.set(i.category, e);
    }
  }
  const topCategories = [...byCat.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3);
  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-6)
    .map(([month, spend]) => ({ month, spend }));

  return NextResponse.json({
    summary: {
      orders: orders.length,
      totalSpent,
      topCategories,
      monthly,
    },
  });
}
