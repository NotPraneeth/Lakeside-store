import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="section-label">{eyebrow}</p>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-50 md:text-2xl">{title}</h2>
        {sub && <p className="mt-1 max-w-xl text-sm text-zinc-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-xl text-indigo-300">
        ◌
      </div>
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton-shimmer h-44 w-full" />
      <div className="flex flex-col gap-2 p-4">
        <div className="skeleton-shimmer h-3 w-1/3 rounded-full" />
        <div className="skeleton-shimmer h-4 w-4/5 rounded-full" />
        <div className="skeleton-shimmer mt-2 h-4 w-1/4 rounded-full" />
      </div>
    </div>
  );
}

export function QtyStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  small,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  small?: boolean;
}) {
  const btn = small
    ? "h-7 w-7 text-sm"
    : "h-8 w-8 text-base";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${btn} inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/70 font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800/70`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`${small ? "w-7 text-sm" : "w-9 text-sm"} text-center font-semibold text-zinc-100 tabular-nums`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${btn} inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/70 font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-zinc-700 disabled:hover:bg-zinc-800/70`}
      >
        +
      </button>
    </div>
  );
}

export function CategoryBadge({ name }: { name: string }) {
  return <span className="badge-accent">{name}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const placed = status === "placed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        placed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-600 bg-zinc-800 text-zinc-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${placed ? "bg-emerald-400" : "bg-zinc-400"}`} />
      {status}
    </span>
  );
}

export function BrowseLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 transition hover:text-indigo-200"
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
