import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Order } from "@/models/Order";

// GET /api/orders/:id — one order; must belong to the logged-in user.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    // Return 404 (not 400) so a user can't probe which IDs exist.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await connectDb();

  const o = await Order.findOne({
    _id: id,
    userId: new mongoose.Types.ObjectId(user.id),
  }).lean<{
    _id: unknown;
    items: { productId: unknown; name: string; category: string; unitPrice: number; quantity: number }[];
    subtotal: number;
    total: number;
    status: string;
    shippingAddress: Record<string, string>;
  } & { createdAt: Date } | null>();

  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    order: {
      id: String(o._id),
      items: o.items.map((i) => ({
        productId: String(i.productId),
        name: i.name,
        category: i.category,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.unitPrice * i.quantity,
      })),
      subtotal: o.subtotal,
      total: o.total,
      status: o.status,
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt,
    },
  });
}
