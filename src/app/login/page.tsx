"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      window.dispatchEvent(new Event("auth-updated"));
      toast(`Welcome back, ${data.user?.name ?? "shopper"}!`);
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 py-10 md:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-1/4 h-64 w-64 rounded-full bg-indigo-600/20 blur-[100px]"
      />
      <div className="relative grid overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 md:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600/30 via-zinc-900 to-zinc-950 p-8 md:flex">
          <div
            aria-hidden
            className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-500/25 blur-[80px]"
          />
          <p className="flex items-center gap-2 text-base font-bold text-zinc-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
              ≋
            </span>
            Lakeside Store
          </p>
          <div>
            <h2 className="text-2xl leading-snug font-extrabold tracking-tight text-zinc-50">
              Good to see you
              <br />
              by the lake again.
            </h2>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-zinc-300">
              {["Persistent cart across sessions", "One-click checkout", "Full purchase history"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-300">
                      ✓
                    </span>
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>
          <p className="text-xs text-zinc-500">Secure sign-in · shop in seconds.</p>
        </div>

        <div className="p-6 md:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50">Log in</h1>
          <p className="mt-1 text-sm text-zinc-400">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">
              Sign up
            </Link>
          </p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Password
              <span className="relative block">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-100"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-1 w-full py-3">
              {busy ? "Logging in…" : "Log in →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
