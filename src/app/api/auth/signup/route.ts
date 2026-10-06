import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import { User } from "@/models/User";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  await connectDb();

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: "customer" });

  const token = await signToken({ sub: String(user._id), role: user.role });
  await setAuthCookie(token);

  return NextResponse.json(
    { user: { id: String(user._id), name: user.name, email: user.email, role: user.role } },
    { status: 201 }
  );
}
