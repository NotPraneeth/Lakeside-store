import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Keep this file self-contained: do NOT import from @/lib/* here.
// Proxy runs before routes; the real auth check (JWT verify) happens in
// API routes and server components via getCurrentUser().
const AUTH_COOKIE = "shop_token";

export function proxy(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/cart/:path*", "/orders/:path*", "/profile/:path*", "/admin/:path*"],
};
