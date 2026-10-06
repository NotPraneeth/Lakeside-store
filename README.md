# Lakeside Store — Stage 1 (minimal e-commerce store)

Minimal but fully working online store on MongoDB. See `../implementation.md` for the full plan.

Stage 1 scope: signup/login, browse products (search + category filter), cart, mock checkout, profile, purchase history. Stage 2 (analytics + events) lives in `analytics/` and the `events` collection.

## Prerequisites

- Node.js LTS, npm, Git
- Docker Desktop (for local MongoDB) **or** a free MongoDB Atlas cluster

## Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local:
#   MONGODB_URI=mongodb://127.0.0.1:27017/shop
#   JWT_SECRET=<long random string, min 32 chars>
```

Start MongoDB (local):

```bash
docker compose up -d
```

Seed the catalog (60 products, 4 categories, safe to re-run):

```bash
npm run seed
```

Run the app:

```bash
npm run dev
# open http://localhost:3000
```

Health check: `GET /api/health` returns `{ "db": "ok" }` when MongoDB is reachable.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (must be clean) |
| `npm run test` | Vitest: cart totals, validators, NoSQL-injection guards |
| `npm run seed` | Re-seed products (`scripts/seed-products.ts`) |

## Env variables

| Var | Example | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/shop` | Never commit real secrets; `.env*` is gitignored |
| `JWT_SECRET` | 64-hex-char random string | Min 32 chars; auth cookie is httpOnly, SameSite=Lax, Secure in production, 7-day expiry |

## Manual test script (run before calling Stage 1 done)

1. Sign up → log out → log in. Refresh: stay logged in. Visit `/cart` logged out: redirects to `/login`.
2. Search "mouse", filter by category, open a product page.
3. Add 2 different items → change a quantity → remove one. Log out/in: cart persists.
4. Place order → confirmation screen → appears in `/orders` with correct total → stock drops → cart empties.
5. Open someone else's `/orders/<id>` URL → expect 404.
6. Try to buy more than stock → expect clear error (`Only N in stock`).

## Notes for Stage 2

- Orders snapshot `name`, `category`, `unitPrice` per item + `createdAt` — this is the AI's main data source.
- Prices are integers (paise/cents), never floats; formatting only in `src/lib/money.ts`.
- `users.role` (`customer`/`admin`) already exists for the future admin dashboard.
- Server computes all totals; client prices are ignored.

## Behavioral events (`events` collection)

The site logs fire-and-forget analytics events for funnel + recommender work:

| Type | Logged where |
|---|---|
| `product_view` | Detail page beacon (`POST /api/events`, guest-safe via `lakeside_sid` cookie) |
| `add_to_cart` / `remove_from_cart` | Server-side in `POST/PATCH/DELETE /api/cart/items` (only on success, with live price snapshot) |
| `search` / `category_filter` | Storefront toolbar beacons |

Purchases are **derived from `orders`**, never logged (no double-counting).
Events carry `userId` (when logged in) + `sessionId` (always), snapshots
(`category`, `unitPrice`), and auto-expire after ~13 months (TTL index).
See `analytics/README.md` for the batch jobs that read them.
