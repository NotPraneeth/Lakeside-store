"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

type Tab = "profile" | "address" | "security";

const TABS: { v: Tab; label: string }[] = [
  { v: "profile", label: "Profile" },
  { v: "address", label: "Address" },
  { v: "security", label: "Security" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      try {
        const r = await fetch("/api/profile");
        if (cancelled) return;
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        const d = await r.json();
        if (cancelled || !d) return;
        setName(d.user.name ?? "");
        setEmail(d.user.email ?? "");
        setLine1(d.user.address?.line1 ?? "");
        setCity(d.user.address?.city ?? "");
        setPostalCode(d.user.address?.postalCode ?? "");
        setCountry(d.user.address?.country ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: { line1, city, state: "", postalCode, country } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Save failed", "error");
        return;
      }
      window.dispatchEvent(new Event("auth-updated"));
      toast("Profile saved ✓");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChanging(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Change failed", "error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast("Password changed ✓");
    } finally {
      setChanging(false);
    }
  }

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="skeleton-shimmer h-28 rounded-3xl" />
        <div className="skeleton-shimmer mt-4 h-64 rounded-3xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:py-10">
      <div className="card flex items-center gap-4 p-5 md:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-xl font-extrabold text-white shadow-lg shadow-indigo-500/30">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-zinc-50">{name || "Your profile"}</h1>
          <p className="truncate text-sm text-zinc-400">{email}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              tab === t.v
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "profile" || tab === "address") && (
        <form onSubmit={saveProfile} className="card mt-4 flex flex-col gap-3.5 p-5 md:p-6">
          {tab === "profile" ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                autoComplete="name"
                className="input"
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                Address line
                <input
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="Flat, street"
                  autoComplete="street-address"
                  className="input"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                  City
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    className="input"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                  Postal code
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    autoComplete="postal-code"
                    className="input"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                Country
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  autoComplete="country-name"
                  className="input"
                />
              </label>
              <p className="text-xs text-zinc-500">
                Saved to your account and pre-filled as the shipping address on your next order.
              </p>
            </>
          )}
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}

      {tab === "security" && (
        <form onSubmit={changePassword} className="card mt-4 flex flex-col gap-3.5 p-5 md:p-6">
          <h2 className="text-base font-bold text-zinc-50">Change password</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Min 8 characters"
              className="input"
            />
            {newPassword && (
              <span className={`text-xs ${newPassword.length >= 8 ? "text-emerald-300" : "text-zinc-500"}`}>
                {newPassword.length >= 8 ? "✓ Good length" : `${newPassword.length}/8 characters`}
              </span>
            )}
          </label>
          <button type="submit" disabled={changing} className="btn-secondary w-full sm:w-auto">
            {changing ? "Changing…" : "Change password"}
          </button>
        </form>
      )}

      <ShoppingSummary />
    </main>
  );
}

function ShoppingSummary() {
  const [data, setData] = useState<{
    orders: number;
    totalSpent: number;
    topCategories: { category: string; spend: number; units: number }[];
    monthly: { month: string; spend: number }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d.summary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div className="card mt-4 border-dashed p-5">
        <div className="skeleton-shimmer h-4 w-48 rounded-full" />
        <div className="skeleton-shimmer mt-2 h-3 w-64 rounded-full" />
      </div>
    );
  }

  if (data.orders === 0) {
    return (
      <div className="card mt-4 border-dashed p-5">
        <p className="text-sm font-bold text-zinc-200">📊 Your shopping summary</p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
          Total spent, top categories, and monthly spend will appear here as you shop.
        </p>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...data.monthly.map((m) => m.spend));
  return (
    <div className="card mt-4 p-5">
      <p className="text-sm font-bold text-zinc-200">📊 Your shopping summary</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-zinc-950/60 px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Total spent</p>
          <p className="text-base font-extrabold text-zinc-50 tabular-nums">
            {(data.totalSpent / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-950/60 px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Orders</p>
          <p className="text-base font-extrabold text-zinc-50 tabular-nums">{data.orders}</p>
        </div>
      </div>
      {data.topCategories.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Top categories</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {data.topCategories.map((c) => (
              <li key={c.category} className="flex justify-between text-[13px]">
                <span className="text-zinc-300">{c.category} <span className="text-zinc-500">· {c.units} items</span></span>
                <span className="font-bold text-zinc-100 tabular-nums">
                  {(c.spend / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.monthly.length > 1 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Monthly spend</p>
          <div className="mt-1.5 flex h-16 items-end gap-1.5">
            {data.monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-indigo-500/70"
                  style={{ height: `${Math.max(4, Math.round((m.spend / maxMonth) * 56))}px` }}
                  title={`${m.month}: ₹${(m.spend / 100).toLocaleString("en-IN")}`}
                />
                <span className="text-[9px] text-zinc-500">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
