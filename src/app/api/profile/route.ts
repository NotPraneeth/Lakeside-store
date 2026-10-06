import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { passwordChangeSchema, profileUpdateSchema } from "@/lib/validators";
import { User } from "@/models/User";

// GET /api/profile — read own profile.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();

  const u = await User.findById(user.id).lean<{
    _id: unknown;
    name: string;
    email: string;
    role: string;
    address?: Record<string, string>;
  } | null>();
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: { id: String(u._id), name: u.name, email: u.email, role: u.role, address: u.address ?? {} },
  });
}

// PATCH /api/profile — update name / address.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await connectDb();
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.address !== undefined) update.address = parsed.data.address;

  await User.updateOne({ _id: new mongoose.Types.ObjectId(user.id) }, { $set: update });
  return NextResponse.json({ ok: true });
}

// POST /api/profile/password — change password (asks current password first).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await connectDb();
  const u = await User.findById(user.id).select("+passwordHash").lean<{
    _id: unknown;
    passwordHash: string;
  } | null>();
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await verifyPassword(parsed.data.currentPassword, u.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(user.id) },
    { $set: { passwordHash: await hashPassword(parsed.data.newPassword) } }
  );
  return NextResponse.json({ ok: true });
}
