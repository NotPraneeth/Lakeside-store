import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";

// GET /api/admin/insights — latest analytics run, read-only. Admin only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDb();

  const db = mongoose.connection.db;
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const segs = db.collection("analytics_segments");
  const pairs = db.collection("analytics_pairs");
  const trends = db.collection("analytics_trends");
  const anomalies = db.collection("analytics_anomalies");
  const funnel = db.collection("analytics_funnel");
  const insights = db.collection("insights");
  const orders = db.collection("orders");

  // latest run = newest kmeans_meta (every run_all writes one)
  const meta = await segs.findOne({ type: "kmeans_meta" }, { sort: { generatedAt: -1 } });
  const runId = (meta?.runId as string) ?? null;

  // live KPIs + monthly revenue + tops straight from orders (fast at this scale)
  const all = await orders
    .find({ status: "placed" }, { projection: { userId: 1, items: 1, total: 1, createdAt: 1 } })
    .toArray();
  const revenue = all.reduce((s, o) => s + (o.total as number), 0);
  const customers = new Set(all.map((o) => String(o.userId))).size;
  const kpis = {
    revenue,
    orders: all.length,
    customers,
    aov: all.length ? Math.round((revenue / all.length) * 100) / 100 : 0,
  };

  // Monthly history (uniform grain with the monthly forecast — mixing weekly
  // bars with monthly forecast dots once read as a phantom spike).
  const monthKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, { revenue: number; orders: number }>();
  for (const o of all) {
    const k = monthKey(o.createdAt as Date);
    const e = byMonth.get(k) ?? { revenue: 0, orders: 0 };
    e.revenue += o.total as number;
    e.orders += 1;
    byMonth.set(k, e);
  }
  let monthly = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, ...v }));
  // drop a trailing partial month (same <40%-of-median rule as forecast.py)
  {
    const counts = monthly.map((m) => m.orders).sort((a, b) => a - b);
    const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
    if (monthly.length > 14 && monthly[monthly.length - 1].orders < 0.4 * median) {
      monthly = monthly.slice(0, -1);
    }
  }
  monthly = monthly.slice(-12);

  const prodAgg = await orders
    .aggregate([
      { $match: { status: "placed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { name: "$items.name", category: "$items.category" },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ])
    .toArray();
  const topProducts = prodAgg.map((p) => ({
    name: p._id.name as string,
    category: p._id.category as string,
    units: p.units as number,
    revenue: p.revenue as number,
  }));
  const catAgg = await orders
    .aggregate([
      { $match: { status: "placed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
    ])
    .toArray();
  const catShare = catAgg.map((c) => ({
    category: c._id as string,
    revenue: c.revenue as number,
    share: revenue ? Math.round(((c.revenue as number) / revenue) * 10000) / 10000 : 0,
  }));

  const q = runId ? { runId } : {};
  const [segMeta, topPairs, catGrowth, forecast, backtest, flags, funnelDocs, insight] =
    await Promise.all([
      segs.findOne({ type: "kmeans_meta", ...q }, { sort: { generatedAt: -1 } }),
      pairs.find(q).sort({ lift: -1 }).limit(12).toArray(),
      trends.find({ ...q, type: "category_growth" }).toArray(),
      trends.find({ ...q, type: "forecast_monthly" }).sort({ month: 1 }).toArray(),
      trends.findOne({ ...q, type: "forecast_backtest" }, { sort: { generatedAt: -1 } }),
      anomalies.find(q).sort({ day: 1 }).toArray(),
      funnel.find(q).toArray(),
      insights.find({}).sort({ generatedAt: -1 }).limit(1).toArray(),
    ]);

  const funnelOverall = funnelDocs.find((d) => d.kind === "overall") ?? null;
  const churnMeta = await segs.findOne({ type: "churn_meta", ...q }, { sort: { generatedAt: -1 } });

  return NextResponse.json({
    runId,
    generatedAt: meta?.generatedAt ?? null,
    kpis,
    monthly,
    topProducts,
    catShare,
    segments: segMeta
      ? {
          k: segMeta.k,
          silhouette: segMeta.silhouette,
          sizes: segMeta.sizes,
          means: segMeta.clusterMeans,
          ariVsPersona: segMeta.adjustedRandVsPersona ?? null,
        }
      : null,
    pairs: topPairs.map((p) => ({
      a: p.a?.name as string,
      b: p.b?.name as string,
      lift: p.lift as number,
      count: p.count as number,
      support: p.support as number,
    })),
    catGrowth: catGrowth.map((c) => ({
      category: c.category as string,
      month: c.month as string,
      momGrowth: c.momGrowth as number,
    })),
    forecast: forecast.map((f) => ({
      month: f.month as string,
      revenue: f.forecastRevenue as number,
    })),
    backtest: backtest
      ? { metrics: backtest.metrics, model: backtest.modelUsed, beatsNaive: backtest.modelBeatsNaive }
      : null,
    anomalies: flags.map((f) => ({
      day: f.day,
      orders: f.orders as number,
      revenue: f.revenue as number,
      reasons: f.reasons as string[],
    })),
    funnel: funnelOverall
      ? {
          views: funnelOverall.views,
          adds: funnelOverall.adds,
          buys: funnelOverall.buys,
          viewToBuy: funnelOverall.viewToBuy,
          abandonment: funnelOverall.abandonment ?? null,
        }
      : null,
    funnelCategories: funnelDocs
      .filter((d) => d.kind === "category")
      .map((d) => ({ category: d.category, viewToBuy: d.viewToBuy, views: d.views, buys: d.buys })),
    atRisk: (churnMeta?.atRiskCount as number) ?? null,
    insight: insight[0]
      ? { text: insight[0].text as string, generatedAt: insight[0].generatedAt }
      : null,
  });
}
