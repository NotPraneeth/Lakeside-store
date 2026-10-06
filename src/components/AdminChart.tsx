"use client";

import { useId } from "react";

/**
 * Hand-rolled SVG: monthly revenue bars + monthly forecast dashed line. No deps.
 * History and forecast share ONE grain (monthly totals) — mixing weekly bars
 * with monthly forecast dots once read as a phantom 4-5x spike.
 */
export default function AdminChart({
  history,
  forecast,
}: {
  history: { period: string; revenue: number }[];
  forecast: { month: string; revenue: number }[];
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 640;
  const H = 230;
  const PAD = { l: 52, r: 12, t: 12, b: 26 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const histMax = Math.max(1, ...history.map((w) => w.revenue));
  const fcMax = Math.max(0, ...forecast.map((f) => f.revenue));
  const max = Math.max(histMax, fcMax) * 1.1;

  const n = history.length;
  const bw = n ? (iw / n) * 0.62 : 0;
  const xHist = (i: number) => PAD.l + (iw / Math.max(1, n)) * i + (iw / Math.max(1, n) - bw) / 2;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const fcStartX = PAD.l + iw;
  const fcEndX = W - PAD.r + 64; // forecast zone extends past history
  const totalW = W + 64;
  const fx = (j: number) => fcStartX + ((j + 1) / (forecast.length + 1)) * (fcEndX - fcStartX);

  const lastHistY = n ? y(history[n - 1].revenue) : y(0);
  const line = forecast
    .map((f, j) => `${j === 0 ? `M ${fcStartX} ${lastHistY}` : "L"} ${fx(j).toFixed(1)} ${y(f.revenue).toFixed(1)}`)
    .join(" ");

  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const fmt = (v: number) =>
    v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${Math.round(v / 1000)}k`;

  return (
    <svg viewBox={`0 0 ${totalW} ${H}`} className="w-full" role="img" aria-label="Monthly revenue with forecast">
      <defs>
        <linearGradient id={`bg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={totalW - 8} y1={y(t)} y2={y(t)} stroke="#27272a" strokeWidth="1" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#71717a">
            {fmt(t)}
          </text>
        </g>
      ))}
      {history.map((w, i) => (
        <rect
          key={w.period}
          x={xHist(i)}
          y={y(w.revenue)}
          width={bw}
          height={Math.max(1, PAD.t + ih - y(w.revenue))}
          rx="2"
          fill={`url(#bg-${gid})`}
        >
          <title>{`${w.period}: ₹${(w.revenue / 100).toLocaleString("en-IN")}`}</title>
        </rect>
      ))}
      {forecast.length > 0 && (
        <g>
          <line x1={fcStartX} x2={fcStartX} y1={PAD.t} y2={PAD.t + ih} stroke="#52525b" strokeDasharray="3 3" />
          <path d={line} fill="none" stroke="#e879f9" strokeWidth="2" strokeDasharray="6 3" />
          {forecast.map((f, j) => (
            <g key={f.month}>
              <circle cx={fx(j)} cy={y(f.revenue)} r="3.5" fill="#e879f9" stroke="#09090b" strokeWidth="1.5">
                <title>{`${f.month}: forecast ₹${(f.revenue / 100).toLocaleString("en-IN")}`}</title>
              </circle>
              <text x={fx(j)} y={H - 8} textAnchor="middle" fontSize="9" fill="#a1a1aa">
                {f.month.slice(2)}
              </text>
            </g>
          ))}
        </g>
      )}
      {history.length > 0 && (
        <text x={PAD.l} y={H - 8} fontSize="9" fill="#71717a">
          {history[0].period} → {history[n - 1].period} (monthly totals)
        </text>
      )}
    </svg>
  );
}
