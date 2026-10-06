import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureSessionId, logEvent } from "@/lib/events";
import { eventSchema } from "@/lib/validators";
import { Product } from "@/models/Product";
import { connectDb } from "@/lib/db";

// POST /api/events — fire-and-forget behavioral beacon. No auth required
// (guests tracked by session cookie). Purchases are NOT logged here; they
// are derived from `orders`.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { type, quantity, searchTerm, category } = parsed.data;
  let productId: string | null = null;
  let snapshot: { category: string; unitPrice: number } | null = null;

  if (parsed.data.productId) {
    if (!mongoose.Types.ObjectId.isValid(parsed.data.productId)) {
      return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
    }
    await connectDb();
    const p = await Product.findOne({
      _id: parsed.data.productId,
      isActive: true,
    }).lean<{ category: string; price: number } | null>();
    if (!p) return NextResponse.json({ error: "Unknown product" }, { status: 404 });
    productId = parsed.data.productId;
    snapshot = { category: p.category, unitPrice: p.price };
  }

  // product_view / cart events require a real product; search / filter don't.
  if ((type === "product_view" || type === "add_to_cart" || type === "remove_from_cart") && !productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  if ((type === "search" || type === "category_filter") && !searchTerm && !category && !productId) {
    return NextResponse.json({ error: "searchTerm or category is required" }, { status: 400 });
  }

  const user = await getCurrentUser().catch(() => null);
  const sessionId = await ensureSessionId();
  await logEvent({
    userId: user?.id ?? null,
    sessionId,
    type,
    productId,
    category: snapshot?.category ?? category ?? null,
    unitPrice: snapshot?.unitPrice ?? null,
    quantity: quantity ?? null,
    searchTerm: searchTerm || null,
  });
  return NextResponse.json({ ok: true });
}
