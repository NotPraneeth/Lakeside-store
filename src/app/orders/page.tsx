"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { EmptyState, StatusPill } from "@/components/ui";

type OrderSummary = {
  id: string;
  itemCount: number;
  total: number;
  status: string;
  createdAt: string;
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchOrders() {
      try {
        const r = await fetch("/api/orders");
        if (cancelled) return;
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        const d = await r.json();
        if (!cancelled) setOrders(d.orders ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchOrders();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spent = orders.reduce((s, o) => s + o.total, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      <p className="section-label">History</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50 md:text-3xl">
          Purchase history
        </h1>
        {!loading && orders.length > 0 && (
          <p className="text-sm text-zinc-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-zinc-100 tabular-nums">{formatMoney(spent)}</strong> lifetime
          </p>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-20 rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            body="Your placed orders will appear here with totals and receipts."
            action={
              <Link href="/" className="btn-primary">
                Start shopping →
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="group card flex items-center gap-4 p-4 transition duration-200 hover:-translate-y-px hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 md:px-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-lg">
                    📦
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">
                        {new Date(o.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <StatusPill status={o.status} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {new Date(o.createdAt).toLocaleTimeString()} · {o.itemCount} item
                      {o.itemCount === 1 ? "" : "s"} · #{o.id.slice(-6).toUpperCase()}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-extrabold text-zinc-50 tabular-nums">
                    {formatMoney(o.total)}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
