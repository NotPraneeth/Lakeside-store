import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";

export async function GET() {
  try {
    const m = await connectDb();
    // Ping admin to prove the connection really works.
    await m.connection.db?.admin().ping();
    return NextResponse.json({ db: "ok" });
  } catch (err) {
    console.error("DB health check failed", err);
    return NextResponse.json({ db: "error" }, { status: 500 });
  }
}
