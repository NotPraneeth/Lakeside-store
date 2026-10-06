"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { StatusPill } from "@/components/ui";

type OrderDetail = {
  id: string;
  items: { productId: string; name: string; category: string; unitPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  total: number;
  status: string;
  createdAt: string;
};

const STEPS = ["Placed", "Packed", "Shipped", "Delivered"];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchOrder() {
      try {
        const r = await fetch(`/api/orders/${id}`);
        if (cancelled) return;
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        if (!r.ok) {
          if (!cancelled) setOrder(null);
          return;
        }
        const d = await r.json();
        if (!cancelled) setOrder(d.order);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchOrder();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="skeleton-shimmer h-40 rounded-3xl" />
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold text-zinc-50">Order not found</h1>
        <p className="mt-1 text-sm text-zinc-400">
          It may belong to another account — we return 404 either way.
        </p>
        <Link href="/orders" className="btn-primary mt-5">
          Back to history
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-10">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/15 via-zinc-900 to-zinc-900 p-6 text-center md:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow-lg shadow-emerald-500/40">
          ✓
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-50">
          Order confirmed
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {new Date(order.createdAt).toLocaleString()} · #{order.id.slice(-6).toUpperCase()}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <StatusPill status={order.status} />
          <span className="text-lg font-extrabold text-zinc-50 tabular-nums">
            {formatMoney(order.total)}
          </span>
        </div>
      </div>

      <div className="card mt-4 p-4 md:p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                      : "border border-zinc-700 bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {i === 0 ? "✓" : i + 1}
                </span>
                <span className={`text-[11px] font-medium ${i === 0 ? "text-indigo-200" : "text-zinc-500"}`}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && <span className="mx-1 mb-5 h-px flex-1 bg-zinc-800" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Tracking updates will appear here as your order moves.
        </p>
      </div>

      <div className="card mt-4 overflow-hidden">
        <p className="border-b border-zinc-800 px-4 py-3 text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase md:px-5">
          Items
        </p>
        <ul className="divide-y divide-zinc-800/70">
          {order.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 px-4 py-3 md:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{i.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {i.category} · {formatMoney(i.unitPrice)} × {i.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-zinc-50 tabular-nums">
                {formatMoney(i.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/50 px-4 py-3.5 md:px-5">
          <span className="text-sm font-bold text-zinc-200">Total</span>
          <span className="text-lg font-extrabold text-zinc-50 tabular-nums">
            {formatMoney(order.total)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/orders" className="btn-secondary">
          ← All orders
        </Link>
        <Link href="/" className="btn-primary">
          Shop more →
        </Link>
      </div>
    </main>
  );
}
