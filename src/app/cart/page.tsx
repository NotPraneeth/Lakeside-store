"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { toast } from "@/lib/toast";
import { EmptyState, QtyStepper } from "@/components/ui";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  currency: string;
  imageUrl: string;
  stock: number;
  quantity: number;
  lineTotal: number;
};

const FREE_SHIP_AT = 99900; // ₹999 — progress-bar motivator (mock, no real shipping)

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setSubtotal(data.subtotal ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchCart() {
      try {
        const res = await fetch("/api/cart");
        if (cancelled) return;
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setSubtotal(data.subtotal ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchCart();
    return () => {
      cancelled = true;
    };
    // Initial fetch only; refreshes call load() from event handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setQty(productId: string, quantity: number) {
    setUpdating(productId);
    try {
      const res = await fetch("/api/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not update quantity", "error");
        return;
      }
      if (quantity === 0) toast("Removed from cart", "info");
      window.dispatchEvent(new Event("cart-updated"));
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(productId: string, name: string) {
    setUpdating(productId);
    try {
      await fetch(`/api/cart/items?productId=${productId}`, { method: "DELETE" });
      window.dispatchEvent(new Event("cart-updated"));
      toast(`Removed ${name}`, "info");
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Checkout failed", "error");
        return;
      }
      window.dispatchEvent(new Event("cart-updated"));
      toast("Order placed! 🎉");
      router.push(`/orders/${data.orderId}`);
    } finally {
      setPlacing(false);
    }
  }

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const progress = Math.min(1, subtotal / FREE_SHIP_AT);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton-shimmer h-64 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <p className="section-label">Checkout</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-50 md:text-3xl">
        Your cart {count > 0 && <span className="text-zinc-500">· {count} items</span>}
      </h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Your cart is empty"
            body="Fill it with something you like — checkout takes one click."
            action={
              <Link href="/" className="btn-primary">
                Browse catalog →
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_340px]">
          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <li
                key={i.productId}
                className={`card flex items-center gap-3.5 p-3.5 transition md:p-4 ${updating === i.productId ? "opacity-60" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl || "/images/placeholder.svg"}
                  alt={i.name}
                  className="h-16 w-16 shrink-0 rounded-xl border border-zinc-800 object-cover md:h-20 md:w-20"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${i.productId}`}
                    className="truncate text-[15px] font-semibold text-zinc-50 hover:text-indigo-200 hover:underline"
                  >
                    {i.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
                    {formatMoney(i.unitPrice, i.currency)} each
                  </p>
                  <div className="mt-2 md:hidden">
                    <QtyStepper
                      small
                      value={i.quantity}
                      min={0}
                      max={Math.min(i.stock, 99)}
                      onChange={(v) => void setQty(i.productId, v)}
                    />
                  </div>
                </div>
                <div className="hidden md:block">
                  <QtyStepper
                    value={i.quantity}
                    min={0}
                    max={Math.min(i.stock, 99)}
                    onChange={(v) => void setQty(i.productId, v)}
                  />
                </div>
                <p className="w-20 shrink-0 text-right text-[15px] font-bold text-zinc-50 tabular-nums md:w-24">
                  {formatMoney(i.lineTotal, i.currency)}
                </p>
                <button
                  type="button"
                  onClick={() => void removeItem(i.productId, i.name)}
                  aria-label={`Remove ${i.name}`}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
            <li>
              <Link
                href="/"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              >
                <span aria-hidden>←</span> Continue shopping
              </Link>
            </li>
          </ul>

          <aside className="card sticky top-20 p-5">
            <div className="mb-4 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-indigo-200">
                  {subtotal >= FREE_SHIP_AT
                    ? "🎉 You unlocked free shipping!"
                    : `${formatMoney(FREE_SHIP_AT - subtotal)} away from free shipping`}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-400 transition-all duration-500"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-400">Items</dt>
                <dd className="font-semibold text-zinc-100 tabular-nums">{count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-400">Subtotal</dt>
                <dd className="font-semibold text-zinc-100 tabular-nums">
                  {formatMoney(subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-400">Shipping</dt>
                <dd className="font-semibold text-emerald-300">Free</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-zinc-800 pt-3 text-base">
                <dt className="font-bold text-zinc-50">Total</dt>
                <dd className="font-extrabold text-zinc-50 tabular-nums">
                  {formatMoney(subtotal)}
                </dd>
              </div>
            </dl>

            <button
              onClick={placeOrder}
              disabled={placing}
              className="btn-primary mt-4 w-full py-3"
            >
              {placing ? "Placing order…" : "Place order"}
            </button>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-zinc-500">
              Demo checkout — no real payment is processed.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
