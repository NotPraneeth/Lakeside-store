import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { connectDb } from "./db";
import { ShopEvent } from "@/models/Event";

export const SESSION_COOKIE = "lakeside_sid";
// Guest sessions live ~400 days; logging in keeps the same sid so pre-signup
// browsing links to the new account via userId going forward.
const SESSION_MAX_AGE = 60 * 60 * 24 * 400;

export type EventType =
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "search"
  | "category_filter";

/** Read the guest session id, creating + setting it when missing. Route handlers only. */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing && existing.length <= 64) return existing;
  const sid = randomUUID();
  store.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return sid;
}

export async function logEvent(input: {
  userId?: string | null;
  sessionId: string;
  type: EventType;
  productId?: string | null;
  category?: string | null;
  unitPrice?: number | null;
  quantity?: number | null;
  searchTerm?: string | null;
}): Promise<void> {
  // Analytics must never break the shop: swallow logging failures.
  // NOTE: nulls are stripped, not stored — Mongoose runs `validate` even on
  // explicit nulls (Number.isInteger(null) fails), while missing keys cleanly
  // fall back to the schema defaults.
  try {
    await connectDb();
    const doc: Record<string, unknown> = {
      sessionId: input.sessionId,
      type: input.type,
    };
    if (input.userId) doc.userId = new mongoose.Types.ObjectId(input.userId);
    if (input.productId) doc.productId = new mongoose.Types.ObjectId(input.productId);
    if (input.category != null) doc.category = input.category;
    if (input.unitPrice != null) doc.unitPrice = input.unitPrice;
    if (input.quantity != null) doc.quantity = input.quantity;
    if (input.searchTerm != null) doc.searchTerm = input.searchTerm;
    await ShopEvent.create(doc);
  } catch (err) {
    console.error("event log failed (non-fatal)", err);
  }
}
