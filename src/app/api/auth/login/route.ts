import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { setAuthCookie, signToken, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { User } from "@/models/User";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    // Generic message: don't reveal whether the email exists.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const email = parsed.data.email.toLowerCase();
  await connectDb();

  // passwordHash is select:false in the schema, so explicitly include it.
  const user = await User.findOne({ email }).select("+passwordHash name email role").lean<{
    _id: unknown;
    name: string;
    email: string;
    role: string;
    passwordHash: string;
  } | null>();

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signToken({ sub: String(user._id), role: user.role });
  await setAuthCookie(token);

  return NextResponse.json({
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
}
