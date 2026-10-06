import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { Product } from "@/models/Product";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await connectDb();
  const p = await Product.findOne({ _id: id, isActive: true }).lean<{
    _id: unknown;
    name: string;
    description: string;
    category: string;
    price: number;
    currency: string;
    imageUrl: string;
    stock: number;
    isActive: boolean;
  } | null>();
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    product: {
      id: String(p._id),
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      currency: p.currency,
      imageUrl: p.imageUrl,
      stock: p.stock,
      isActive: p.isActive,
    },
  });
}
