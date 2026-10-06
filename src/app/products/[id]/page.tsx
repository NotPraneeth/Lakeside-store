"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { beacon } from "@/lib/beacon";
import { formatMoney } from "@/lib/money";
import { toast } from "@/lib/toast";
import type { ProductDto } from "@/components/ProductCard";
import ProductCard from "@/components/ProductCard";
import { CategoryBadge, QtyStepper } from "@/components/ui";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [related, setRelated] = useState<ProductDto[]>([]);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/products/${id}`);
        const d = res.ok ? await res.json() : null;
        if (cancelled) return;
        setProduct(d?.product ?? null);
        if (d?.product && viewedRef.current !== id) {
          viewedRef.current = id;
          beacon({ type: "product_view", productId: id });
        }
        if (d?.product?.category) {
          try {
            const r = await fetch(
              `/api/products?category=${encodeURIComponent(d.product.category)}`
            );
            const rd = await r.json();
            if (!cancelled) {
              setRelated(
                (rd.products ?? []).filter((p: ProductDto) => p.id !== id).slice(0, 4)
              );
            }
          } catch {
            /* related is best-effort */
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addToCart() {
    setAdding(true);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, quantity: qty }),
      });
      if (res.status === 401) {
        toast("Log in to add items to your cart", "info");
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not add to cart", "error");
        return;
      }
      window.dispatchEvent(new Event("cart-updated"));
      toast(`Added ${qty} × ${product?.name ?? "item"} to cart`);
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="skeleton-shimmer h-4 w-48 rounded-full" />
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="skeleton-shimmer h-80 rounded-2xl" />
          <div className="flex flex-col gap-3">
            <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
            <div className="skeleton-shimmer h-5 w-1/4 rounded-lg" />
            <div className="skeleton-shimmer h-20 w-full rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-14 text-center">
        <p className="text-4xl">🛸</p>
        <h1 className="mt-3 text-xl font-bold text-zinc-50">Product not found</h1>
        <p className="mt-1 text-sm text-zinc-400">
          It may have been removed or the link is wrong.
        </p>
        <Link href="/" className="btn-primary mt-5">
          Back to shop
        </Link>
      </main>
    );
  }

  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-zinc-500">
        <Link href="/" className="transition hover:text-zinc-200">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href="/" className="transition hover:text-zinc-200">
          Shop
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/?category=${encodeURIComponent(product.category)}`}
          className="transition hover:text-zinc-200"
        >
          {product.category}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-zinc-300">{product.name}</span>
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/3 h-56 w-56 rounded-full bg-indigo-600/20 blur-[90px]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl || "/images/placeholder.svg"}
            alt={product.name}
            className={`relative h-72 w-full object-cover md:h-96 ${out ? "opacity-40 grayscale" : ""}`}
          />
          {out && (
            <span className="absolute top-4 left-4 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-200">
              Out of stock
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <CategoryBadge name={product.category} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-50 md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-2 text-2xl font-extrabold text-zinc-50 tabular-nums md:text-3xl">
            {formatMoney(product.price, product.currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Tax included · Free shipping over ₹999</p>

          <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">{product.description}</p>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${out ? "bg-red-400" : low ? "bg-amber-400" : "bg-emerald-400"}`}
            />
            <span className={out ? "text-red-300" : low ? "text-amber-200" : "text-emerald-200"}>
              {out
                ? "Out of stock"
                : low
                  ? `Only ${product.stock} left in stock`
                  : `${product.stock} in stock`}
            </span>
          </div>

          {!out && (
            <div className="card mt-5 flex flex-wrap items-center gap-3 p-4">
              <QtyStepper value={qty} min={1} max={Math.min(product.stock, 99)} onChange={setQty} />
              <button onClick={addToCart} disabled={adding} className="btn-primary flex-1">
                {adding ? "Adding…" : `Add to cart · ${formatMoney(product.price * qty, product.currency)}`}
              </button>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { t: "Secure checkout", s: "Protected accounts" },
              { t: "Quality picks", s: "Curated catalog" },
              { t: "Easy history", s: "Track every order" },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-2 py-2.5">
                <p className="text-xs font-bold text-zinc-200">{x.t}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{x.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="section-label">Keep exploring</p>
              <h2 className="mt-1 text-xl font-bold text-zinc-50">More in {product.category}</h2>
            </div>
            <Link
              href={`/?category=${encodeURIComponent(product.category)}`}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            >
              View all <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile sticky add-to-cart */}
      {!out && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/90 p-3 backdrop-blur-xl md:hidden">
          <button onClick={addToCart} disabled={adding} className="btn-primary w-full">
            {adding ? "Adding…" : `Add to cart · ${formatMoney(product.price * qty, product.currency)}`}
          </button>
        </div>
      )}
    </main>
  );
}
