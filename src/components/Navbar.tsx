"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { id: string; name: string; email: string; role: string };

async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as Me;
  } catch {
    return null;
  }
}

async function fetchCartCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/cart");
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.count === "number") return d.count;
    if (Array.isArray(d.items)) {
      return d.items.reduce((n: number, i: { quantity: number }) => n + i.quantity, 0);
    }
    return null;
  } catch {
    return null;
  }
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Navbar() {
  const [user, setUser] = useState<Me | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchMe().then(setUser);
    fetchCartCount().then((c) => {
      if (typeof c === "number") setCartCount(c);
    });
    const onUpdate = () => {
      fetchMe().then(setUser);
      fetchCartCount().then((c) => {
        if (typeof c === "number") setCartCount(c);
      });
    };
    window.addEventListener("cart-updated", onUpdate);
    window.addEventListener("auth-updated", onUpdate);
    return () => {
      window.removeEventListener("cart-updated", onUpdate);
      window.removeEventListener("auth-updated", onUpdate);
    };
  }, []);

  function closeMenus() {
    setMobileOpen(false);
    setMenuOpen(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCartCount(0);
    setMenuOpen(false);
    window.dispatchEvent(new Event("auth-updated"));
    router.push("/");
    router.refresh();
  }

  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      onClick={closeMenus}
      className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition md:inline-flex ${
        isActivePath(pathname, href)
          ? "bg-zinc-800/80 text-zinc-50"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={closeMenus}>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500 text-base text-white shadow-lg shadow-indigo-500/30">
            ≋
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-zinc-50">
              Lakeside Store
            </span>
            <span className="block text-[10px] font-semibold tracking-[0.22em] text-indigo-400 uppercase">
              Everyday essentials
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center md:flex">
            {navLink("/", "Shop")}
            {user && navLink("/orders", "Orders")}
          </div>

          <Link
            href="/cart"
            onClick={closeMenus}
            aria-label={`Cart, ${cartCount} items`}
            className={`relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              isActivePath(pathname, "/cart")
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
            }`}
          >
            <span aria-hidden>🛒</span>
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-indigo-500/40">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-200 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/25"
              >
                {initial}
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
                  >
                    <p className="truncate border-b border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-400">
                      {user.name}
                    </p>
                    <Link
                      href="/orders"
                      onClick={closeMenus}
                      className="block px-3.5 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Purchase history
                    </Link>
                    <Link
                      href="/profile"
                      onClick={closeMenus}
                      className="block px-3.5 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Profile & settings
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="block w-full px-3.5 py-2.5 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10"
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link href="/login" className="btn-ghost" onClick={closeMenus}>
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={closeMenus}
                className="rounded-xl bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
              >
                Sign up
              </Link>
            </div>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 md:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-zinc-800/70 bg-zinc-950 px-4 pt-2 pb-4 md:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href="/"
              onClick={closeMenus}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-100"
            >
              Shop
            </Link>
            {user && (
              <Link
                href="/orders"
                onClick={closeMenus}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-100"
              >
                Orders
              </Link>
            )}
          </div>
          {!user && (
            <div className="mt-2.5 flex gap-2">
              <Link href="/login" onClick={closeMenus} className="btn-secondary flex-1">
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={closeMenus}
                className="flex-1 rounded-xl bg-indigo-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
