"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminChart from "@/components/AdminChart";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui";

type Data = {
  runId: string | null;
  generatedAt: string | null;
  kpis: { revenue: number; orders: number; customers: number; aov: number };
  monthly: { month: string; revenue: number; orders: number }[];
  topProducts: { name: string; category: string; units: number; revenue: number }[];
  catShare: { category: string; revenue: number; share: number }[];
  segments: {
    k: number;
    silhouette: number;
    sizes: Record<string, number>;
    means: Record<string, { recency: number; frequency: number; monetary: number; segment: string }>;
  } | null;
  pairs: { a: string; b: string; lift: number; count: number; support: number }[];
  catGrowth: { category: string; month: string; momGrowth: number }[];
  forecast: { month: string; revenue: number }[];
  backtest: { metrics: Record<string, { mae: number; mape: number }>; model: string; beatsNaive: boolean } | null;
  anomalies: { day: string; orders: number; revenue: number; reasons: string[] }[];
  funnel: { views: number; adds: number; buys: number; viewToBuy: number; abandonment: { abandonRate: number } | null } | null;
  funnelCategories: { category: string; viewToBuy: number; views: number; buys: number }[];
  atRisk: number | null;
  insight: { text: string; generatedAt: string } | null;
};

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold tracking-wide text-zinc-100 uppercase">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminInsightsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchInsights() {
      try {
        const res = await fetch("/api/admin/insights");
        if (cancelled) return;
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          setDenied(true);
          return;
        }
        if (res.ok) setData(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchInsights();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="skeleton-shimmer h-8 w-64 rounded-lg" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton-shimmer mt-4 h-64 rounded-2xl" />
      </main>
    );
  }

  if (denied) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14">
        <EmptyState
          title="Admins only"
          body="Your account doesn't have the admin role. Ask the store owner to promote it."
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14">
        <EmptyState title="Couldn't load insights" body="The API didn't respond. Is MongoDB running?" />
      </main>
    );
  }

  const kpis = [
    { label: "Revenue", value: formatMoney(data.kpis.revenue) },
    { label: "Orders", value: data.kpis.orders.toLocaleString("en-IN") },
    { label: "Customers", value: data.kpis.customers.toLocaleString("en-IN") },
    { label: "Avg order", value: formatMoney(Math.round(data.kpis.aov)) },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Owner analytics</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-50 md:text-3xl">
            Insights dashboard
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {data.runId ? (
              <>run <code className="font-mono text-indigo-300">{data.runId}</code>
                {data.generatedAt && <> · {new Date(data.generatedAt).toLocaleString()}</>}</>
            ) : (
              <>no analytics run yet — run <code className="font-mono text-indigo-300">python -m analytics.run_all</code></>
            )}
          </p>
        </div>
      </div>

      {/* AI summary */}
      <div className="card mt-5 border-indigo-500/25 bg-gradient-to-b from-indigo-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-indigo-200 uppercase">✦ AI summary</h2>
          {data.insight && (
            <span className="text-[11px] text-zinc-500">
              {new Date(data.insight.generatedAt).toLocaleString()}
            </span>
          )}
        </div>
        {data.insight ? (
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-zinc-200">{data.insight.text}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">
            No summary yet. Generate one with the insights job (needs <code className="font-mono text-xs text-indigo-300">GEMINI_API_KEY</code>):
            <code className="mt-2 block rounded-lg bg-zinc-950/70 px-3 py-2 font-mono text-xs text-zinc-300">
              analytics/venv/Scripts/python -m analytics.insights_llm
            </code>
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">{k.label}</p>
            <p className="mt-1 text-xl font-extrabold text-zinc-50 tabular-nums md:text-2xl">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue + forecast (uniform monthly grain — same totals the model was backtested on) */}
      <div className="mt-4">
        <Card
          title="Revenue trend + forecast"
          sub={data.backtest ? `Monthly revenue + 2-month forecast · backtest: ${data.backtest.model} MAE ${Math.round(data.backtest.metrics[data.backtest.model]?.mae ?? 0).toLocaleString()} vs naive ${Math.round(data.backtest.metrics.naive?.mae ?? 0).toLocaleString()} — model ${data.backtest.beatsNaive ? "wins ✓" : "loses"}` : "No backtest yet — run the pipeline"}
        >
          {data.monthly.length > 0 ? (
            <AdminChart
              history={data.monthly.map((m) => ({ period: m.month, revenue: m.revenue }))}
              forecast={data.forecast}
            />
          ) : (
            <p className="text-sm text-zinc-500">No order data yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <Card title="Top products" sub="By revenue, all time">
          <ul className="flex flex-col gap-2">
            {data.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs font-bold text-zinc-500 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{p.name}</span>
                  <span className="text-[11px] text-zinc-500">{p.category} · {p.units.toLocaleString()} units</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-zinc-50 tabular-nums">{formatMoney(p.revenue)}</span>
              </li>
            ))}
            {data.topProducts.length === 0 && <p className="text-sm text-zinc-500">No sales yet.</p>}
          </ul>
        </Card>

        {/* Category share */}
        <Card title="Category mix" sub="Revenue share">
          <ul className="flex flex-col gap-3">
            {data.catShare.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-zinc-200">{c.category}</span>
                  <span className="text-zinc-400 tabular-nums">{(c.share * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-400" style={{ width: `${Math.round(c.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Segments */}
        <Card
          title="Customer segments"
          sub={data.segments ? `RFM + K-Means (k=${data.segments.k}, silhouette ${data.segments.silhouette})` : "No segmentation yet — run the pipeline"}
        >
          {data.segments ? (
            <ul className="flex flex-col gap-2.5">
              {Object.entries(data.segments.sizes).map(([seg, n]) => {
                const mean = Object.values(data.segments?.means ?? {}).find((m) => m.segment === seg);
                return (
                  <li key={seg} className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-zinc-100">{seg}</span>
                      <span className="text-zinc-400 tabular-nums">{n} customers</span>
                    </div>
                    {mean && (
                      <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                        avg recency {mean.recency}d · {mean.frequency} orders · {formatMoney(mean.monetary)} total
                      </p>
                    )}
                  </li>
                );
              })}
              {data.atRisk !== null && (
                <p className="text-xs text-amber-200/90">⚠ {data.atRisk} customers flagged at churn risk (silent &gt; 2× their usual gap).</p>
              )}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No segments yet.</p>
          )}
        </Card>

        {/* Pairs */}
        <Card title="Frequently bought together" sub="By lift (above chance)">
          {data.pairs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-wide text-zinc-500 uppercase">
                    <th className="pb-2 font-semibold">Pair</th>
                    <th className="pb-2 text-right font-semibold">Lift</th>
                    <th className="pb-2 text-right font-semibold">Baskets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.pairs.map((p) => (
                    <tr key={`${p.a}+${p.b}`}>
                      <td className="py-2 pr-2 text-zinc-200">{p.a} <span className="text-zinc-500">+</span> {p.b}</td>
                      <td className="py-2 text-right font-bold text-indigo-300 tabular-nums">{p.lift}×</td>
                      <td className="py-2 text-right text-zinc-400 tabular-nums">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No pairs yet.</p>
          )}
        </Card>

        {/* Funnel */}
        <Card title="Browsing funnel" sub="View → cart → buy">
          {data.funnel ? (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-zinc-200 tabular-nums">{data.funnel.views.toLocaleString()} views</span>
                <span aria-hidden className="text-zinc-600">→</span>
                <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-zinc-200 tabular-nums">{data.funnel.adds.toLocaleString()} adds</span>
                <span aria-hidden className="text-zinc-600">→</span>
                <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1 text-indigo-200 tabular-nums">{data.funnel.buys.toLocaleString()} buys</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400 tabular-nums">
                view→buy {(data.funnel.viewToBuy * 100).toFixed(1)}%
                {data.funnel.abandonment && <> · cart abandonment {(data.funnel.abandonment.abandonRate * 100).toFixed(1)}%</>}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {data.funnelCategories.map((c) => (
                  <li key={c.category} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-zinc-300">{c.category}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(100, Math.round(c.viewToBuy * 100))}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs text-zinc-400 tabular-nums">{(c.viewToBuy * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No funnel data — browse the store or generate synthetic events.</p>
          )}
        </Card>

        {/* Anomalies */}
        <Card title="Anomalies" sub="Unusual days worth a look (cause unknown)">
          {data.anomalies.length > 0 ? (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {data.anomalies.map((a) => (
                <li key={String(a.day)} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm">
                  <span className="text-zinc-200 tabular-nums">{new Date(a.day).toLocaleDateString()}</span>
                  <span className="truncate text-[11px] text-zinc-500">{a.reasons.join("; ")}</span>
                  <span className="shrink-0 font-bold text-zinc-100 tabular-nums">{formatMoney(a.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Nothing unusual flagged.</p>
          )}
        </Card>
      </div>

      <p className="mt-6 text-center text-[11px] text-zinc-600">
        Synthetic-data honesty: these results prove the pipeline finds planted patterns — not real-customer performance.
      </p>
    </main>
  );
}
