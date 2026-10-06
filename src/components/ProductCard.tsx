import Link from "next/link";
import { formatMoney } from "@/lib/money";

export type ProductDto = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  stock: number;
  isActive: boolean;
};

const CAT_TINT: Record<string, string> = {
  Electronics: "from-indigo-600/25 via-indigo-500/5 to-transparent",
  Books: "from-amber-500/25 via-amber-500/5 to-transparent",
  Home: "from-emerald-500/25 via-emerald-500/5 to-transparent",
  Fashion: "from-fuchsia-500/25 via-fuchsia-500/5 to-transparent",
};

export default function ProductCard({ product }: { product: ProductDto }) {
  const out = product.stock <= 0;
  const low = !out && product.stock <= 5;
  const tint = CAT_TINT[product.category] ?? "from-indigo-600/25 via-indigo-500/5 to-transparent";

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className={`relative h-44 w-full overflow-hidden bg-gradient-to-b ${tint}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl || "/images/placeholder.svg"}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${out ? "opacity-40 grayscale" : ""}`}
        />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-100 backdrop-blur">
            {product.category}
          </span>
        </div>
        {out && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2">
            <p className="text-xs font-bold tracking-wide text-red-300 uppercase">Out of stock</p>
          </div>
        )}
        {low && (
          <span className="absolute top-2.5 right-2.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 backdrop-blur">
            Only {product.stock} left
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-zinc-50 transition group-hover:text-indigo-200">
          {product.name}
        </h3>
        <p className="line-clamp-1 text-xs text-zinc-500">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <p className="text-[15px] font-bold text-zinc-50 tabular-nums">
            {formatMoney(product.price, product.currency)}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 opacity-0 transition group-hover:opacity-100">
            View <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
