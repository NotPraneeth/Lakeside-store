import Link from "next/link";

const CATS = ["Electronics", "Books", "Home", "Fashion"];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-sm text-white shadow-lg shadow-indigo-500/30">
              ≋
            </span>
            Lakeside Store
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
            Everyday essentials across electronics, books, home, and fashion — curated in one
            lakeside stop.
          </p>
        </div>
        <div>
          <p className="section-label">Shop</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {CATS.map((c) => (
              <li key={c}>
                <Link
                  href={`/?category=${encodeURIComponent(c)}`}
                  className="link-muted"
                >
                  {c}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/" className="link-muted">
                All products
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="section-label">Account</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/cart" className="link-muted">
                Cart
              </Link>
            </li>
            <li>
              <Link href="/orders" className="link-muted">
                Purchase history
              </Link>
            </li>
            <li>
              <Link href="/profile" className="link-muted">
                Profile
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-800/60">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-zinc-500">
          Lakeside Store · Everyday essentials, delivered.
        </p>
      </div>
    </footer>
  );
}
