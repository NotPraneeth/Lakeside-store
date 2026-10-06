"""Generate synthetic behavioral events consistent with the synthetic orders.

For each synthetic order item: preceding add_to_cart + preceding product_views
(same user, same product, earlier timestamps). Plus realistic noise:
- ~8% "direct buys" with no preceding views (deep links)
- abandoned adds (~15% extra adds that never convert)
- pure-browse sessions (views + searches + filters, no purchase)
- a trending spike: 2 products with 8x views for one recent week

Matches the site's real event schema exactly (see src/models/Event.ts), so
the same funnel code analyzes real and synthetic events. Only docs with
isSynthetic:true are ever deleted — real clicks stay untouched.

Usage (from shop/):
    analytics/venv/Scripts/python -m analytics.generate_fake_events [--seed 7]
"""

import argparse
import json
import random
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pymongo import MongoClient

from .config import MONGODB_URI, db_name

DIRECT_BUY_RATE = 0.08
ABANDONED_SESSION_RATE = 0.15
# views per purchased item, by category (Books browse hardest -> converts worst).
# Calibrated so recovered view->buy rank is Electronics > Fashion > Home > Books.
VIEWS_PER_ITEM = {"Electronics": 3, "Books": 12, "Home": 8, "Fashion": 3}
PERSONA_CATEGORY = {"tech": "Electronics", "bookworm": "Books", "home": "Home"}

SEARCH_TERMS = {
    "Electronics": ["mouse", "keyboard", "headphones", "charger", "speaker", "laptop stand", "ssd"],
    "Books": ["novel", "code", "habits", "cookbook", "history", "startup"],
    "Home": ["lamp", "mug", "bedsheet", "candle", "kettle", "plant"],
    "Fashion": ["shirt", "shoes", "watch", "backpack", "kurta", "sunglasses"],
    None: ["gift", "sale", "new", "best seller"],
}
TRENDING_PRODUCTS = ["Smart Watch", "Scented Candle Set"]
TREND_MULTIPLIER = 8

# UTC hours weighted to IST evenings (18:30-22:30 IST = 13-17 UTC)
HOUR_WEIGHTS = [0.4] * 24
for h in (13, 14, 15, 16, 17):
    HOUR_WEIGHTS[h] = 2.2
for h in (3, 4, 5):
    HOUR_WEIGHTS[h] = 0.15


def at_hour(rng: random.Random, day: datetime) -> datetime:
    h = rng.choices(range(24), weights=HOUR_WEIGHTS, k=1)[0]
    return day.replace(hour=h, minute=rng.randint(0, 59), second=rng.randint(0, 59))


def view_doc(user_id, sid, product, ts):
    return {
        "userId": user_id,
        "sessionId": sid,
        "type": "product_view",
        "productId": product["_id"],
        "category": product["category"],
        "unitPrice": int(product["price"]),
        "isSynthetic": True,
        "createdAt": ts,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    client = MongoClient(MONGODB_URI)
    db = client[db_name()]

    users = list(db.users.find({"isSynthetic": True}))
    if not users:
        raise SystemExit("No synthetic users. Run generate_fake_orders first.")
    umap = {u["_id"]: u for u in users}
    products = list(db.products.find({"isActive": True}))
    by_cat: dict[str, list] = defaultdict(list)
    for p in products:
        by_cat[p["category"]].append(p)
    by_name = {p["name"]: p for p in products}
    for name in TRENDING_PRODUCTS:
        if name not in by_name:
            raise SystemExit(f"Trending product missing from catalog: {name}")

    orders = list(db.orders.find({"isSynthetic": True}).sort("createdAt", 1))
    if not orders:
        raise SystemExit("No synthetic orders. Run generate_fake_orders first.")
    max_ts = max(o["createdAt"].replace(tzinfo=timezone.utc) for o in orders)

    docs: list[dict] = []

    def session_views(user_id, sid, category, n, before, days_back=6):
        """n views in `category` (70%) scattered over the days before an order."""
        for _ in range(n):
            pool = by_cat[category]
            others = [p for cat, ps in by_cat.items() if cat != category for p in ps]
            p = rng.choice(pool) if rng.random() < 0.7 else rng.choice(others or pool)
            ts = before - timedelta(days=rng.randint(0, days_back))
            docs.append(view_doc(user_id, sid, p, at_hour(rng, ts)))

    # ---- 1. order-anchored funnels ----
    for o in orders:
        uid = o["userId"]
        user = umap.get(uid)
        if user is None:
            continue
        ots = o["createdAt"].replace(tzinfo=timezone.utc)
        for it in o.get("items", []):
            prod = next((p for p in products if str(p["_id"]) == str(it["productId"])), None)
            if prod is None:
                continue
            sid = str(uuid.uuid4())
            if rng.random() < DIRECT_BUY_RATE:
                continue  # direct buy: no preceding views
            # views of the product + neighbours, then the add
            n_views = VIEWS_PER_ITEM.get(prod["category"], 5)
            docs.append(view_doc(uid, sid, prod, at_hour(rng, ots - timedelta(days=rng.randint(0, 3)))))
            session_views(uid, sid, prod["category"], n_views - 1, ots)
            add_ts = ots - timedelta(minutes=rng.randint(5, 600))
            docs.append({
                "userId": uid, "sessionId": sid, "type": "add_to_cart",
                "productId": prod["_id"], "category": prod["category"],
                "unitPrice": int(prod["price"]), "quantity": int(it.get("quantity", 1)),
                "isSynthetic": True, "createdAt": add_ts,
            })
            if rng.random() < 0.5:  # half the funnels start with a search
                docs.append({
                    "userId": uid, "sessionId": sid, "type": "search",
                    "searchTerm": rng.choice(SEARCH_TERMS.get(prod["category"], SEARCH_TERMS[None])),
                    "isSynthetic": True,
                    "createdAt": add_ts - timedelta(minutes=rng.randint(2, 120)),
                })

    # ---- 2. abandoned + pure-browse sessions (no order) ----
    for u in users:
        persona = u.get("persona", "tech")
        affinity = PERSONA_CATEGORY.get(persona)
        for _ in range(rng.randint(6, 14)):
            sid = str(uuid.uuid4())
            day = max_ts - timedelta(days=rng.randint(0, 400))
            cats = [affinity or rng.choice(list(by_cat))]
            n_views = rng.randint(3, 10)
            for _ in range(n_views):
                cat = cats[0] if rng.random() < 0.7 else rng.choice(list(by_cat))
                docs.append(view_doc(u["_id"], sid, rng.choice(by_cat[cat]), at_hour(rng, day)))
            r = rng.random()
            if r < ABANDONED_SESSION_RATE:  # add but never buy
                p = rng.choice(by_cat[cats[0]])
                docs.append({
                    "userId": u["_id"], "sessionId": sid, "type": "add_to_cart",
                    "productId": p["_id"], "category": p["category"],
                    "unitPrice": int(p["price"]), "quantity": rng.randint(1, 2),
                    "isSynthetic": True, "createdAt": at_hour(rng, day),
                })
            elif r < 0.55:  # browse with a search
                cat = cats[0]
                docs.append({
                    "userId": u["_id"], "sessionId": sid, "type": "search",
                    "searchTerm": rng.choice(SEARCH_TERMS.get(cat, SEARCH_TERMS[None])),
                    "isSynthetic": True, "createdAt": at_hour(rng, day),
                })
            else:  # filter click
                docs.append({
                    "userId": u["_id"], "sessionId": sid, "type": "category_filter",
                    "category": cats[0],
                    "isSynthetic": True, "createdAt": at_hour(rng, day),
                })

    # ---- 3. trending spike: 2 products, 8x views, recent week ----
    spike_end = max_ts - timedelta(days=7)
    spike_start = spike_end - timedelta(days=7)
    spike_views = 0
    for _ in range(600):
        u = rng.choice(users)
        p = by_name[rng.choice(TRENDING_PRODUCTS)]
        ts = spike_start + timedelta(seconds=rng.randint(0, 7 * 86400))
        docs.append(view_doc(u["_id"], str(uuid.uuid4()), p, ts))
        spike_views += 1

    # ---- write (synthetic only) ----
    db.events.delete_many({"isSynthetic": True})
    for i in range(0, len(docs), 2000):
        db.events.insert_many(docs[i:i + 2000])

    truth_path = Path(__file__).resolve().parent / "planted_truth.json"
    truth = json.loads(truth_path.read_text())
    truth["events"] = {
        "seed": args.seed,
        "totalEvents": len(docs),
        "directBuyRate": DIRECT_BUY_RATE,
        "abandonedSessionRate": ABANDONED_SESSION_RATE,
        "viewsPerItemByCategory": VIEWS_PER_ITEM,
        "targetConversionRank": ["Electronics", "Fashion", "Home", "Books"],
        "trendingSpike": {
            "products": TRENDING_PRODUCTS,
            "targetMultiplier": TREND_MULTIPLIER,  # ~8-10x a normal week's views
            "weekStart": spike_start.date().isoformat(),
            "weekEnd": spike_end.date().isoformat(),
            "spikeViews": spike_views,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    truth_path.write_text(json.dumps(truth, indent=2))

    by_type: dict[str, int] = defaultdict(int)
    for d in docs:
        by_type[d["type"]] += 1
    print(f"Inserted {len(docs)} synthetic events: {dict(by_type)}")
    print(f"Trending spike: {TRENDING_PRODUCTS} during {spike_start.date()}..{spike_end.date()}")
    client.close()


if __name__ == "__main__":
    main()
