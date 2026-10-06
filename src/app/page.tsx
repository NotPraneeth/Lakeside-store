"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard, { type ProductDto } from "@/components/ProductCard";
import { EmptyState, SkeletonCard } from "@/components/ui";

type Sort = "newest" | "price-asc" | "price-desc";

const SORTS: { v: Sort; label: string }[] = [
  { v: "newest", label: "Newest" },
  { v: "price-asc", label: "Price ↑" },
  { v: "price-desc", label: "Price ↓" },
];

function Storefront() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "";
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<Sort>("newest");
  const [loading, setLoading] = useState(true);

  const runQuery = useCallback(
    async (opts: { search: string; category: string; sort: Sort }) => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (opts.search.trim()) q.set("search", opts.search.trim());
        if (opts.category) q.set("category", opts.category);
        if (opts.sort !== "newest") q.set("sort", opts.sort);
        q.set("limit", "48");
        const res = await fetch(`/api/products?${q.toString()}`);
        const data = await res.json();
        setProducts(data.products ?? []);
        setCategories(data.categories ?? []);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Refetch when category/sort change (search submits manually).
  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (category) q.set("category", category);
      if (sort !== "newest") q.set("sort", sort);
      q.set("limit", "48");
      try {
        const res = await fetch(`/api/products?${q.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setProducts(data.products ?? []);
        setCategories(data.categories ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchProducts();
    return () => {
      cancelled = true;
    };
    // `search` only joins the query on submit (Search button).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  const hasFilter = search.trim() !== "" || category !== "" || sort !== "newest";

  function clearAll() {
    setSearch("");
    setCategory("");
    setSort("newest");
    void runQuery({ search: "", category: "", sort: "newest" });
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50 md:text-3xl">
            {category || "Shop all products"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {loading ? "Loading…" : `${products.length} item${products.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
          {SORTS.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => {
                setLoading(true);
                setSort(s.v);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                sort === s.v
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runQuery({ search, category, sort });
        }}
      >
        <div className="relative flex-1">
          <span aria-hidden className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500">
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search, e.g. "mouse"'
            aria-label="Search products"
            className="input pr-10 pl-10"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                void runQuery({ search: "", category, sort });
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-200"
            >
              ✕
            </button>
          )}
        </div>
        <button type="submit" className="btn-primary sm:w-auto">
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setCategory("");
          }}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            category === ""
              ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
              : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setLoading(true);
              setCategory(c);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              category === c
                ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {c}
          </button>
        ))}
        {hasFilter && (
          <button type="button" onClick={clearAll} className="btn-ghost text-xs">
            Clear ✕
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products found"
            body="Try a different search term, or clear the filters to browse everything."
            action={
              <button type="button" onClick={clearAll} className="btn-secondary">
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </main>
      }
    >
      <Storefront />
    </Suspense>
  );
}
