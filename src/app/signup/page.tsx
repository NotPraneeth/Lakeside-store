"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pwOk = password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Signup failed");
        return;
      }
      window.dispatchEvent(new Event("auth-updated"));
      toast(`Welcome to Lakeside Store, ${data.user?.name ?? "shopper"}!`);
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
        className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-[100px]"
      />
      <div className="relative grid overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 md:grid-cols-2">
        <div className="p-6 md:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50">Create account</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">
              Log in
            </Link>
          </p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Name
              <input
                required
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Rao"
                className="input"
              />
            </label>
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
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
              {password && (
                <span className={`text-xs ${pwOk ? "text-emerald-300" : "text-zinc-500"}`}>
                  {pwOk ? "✓ Good length" : `${password.length}/8 characters`}
                </span>
              )}
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-1 w-full py-3">
              {busy ? "Creating account…" : "Sign up →"}
            </button>
            <p className="text-center text-[11px] text-zinc-500">
              Your details stay private and secure.
            </p>
          </form>
        </div>

        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-fuchsia-600/20 via-zinc-900 to-zinc-950 p-8 md:flex">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-indigo-500/25 blur-[80px]"
          />
          <p className="section-label">Why join?</p>
          <div className="flex flex-col gap-3">
            {[
              { e: "🛒", t: "Cart that remembers you", s: "Saved to your account on every device." },
              { e: "📦", t: "Track every order", s: "History with totals and receipts." },
              { e: "✨", t: "New arrivals", s: "Fresh picks across 4 departments." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-lg">{x.e}</p>
                <p className="mt-1 text-sm font-bold text-zinc-100">{x.t}</p>
                <p className="text-xs text-zinc-400">{x.s}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Free to join · no card required.</p>
        </div>
      </div>
    </main>
  );
}
