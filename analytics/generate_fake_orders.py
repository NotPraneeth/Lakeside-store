"""Generate synthetic shoppers + orders with PLANTED patterns for Slice B/C validation.

Planted truth (also saved to analytics/planted_truth.json):
- 4 personas: tech/bookworm/home (70% in-category) + bargain (cheapest products)
- weekly rhythm: Sat 1.9x, Sun 1.7x, Fri 1.2x
- festive spike: months 9-10 (0-indexed) at 2.5x + gentle growth 6%/month
- planted pairs bought together (25% attach rate):
    Wireless Mouse + Mechanical Keyboard
    The Pragmatic Programmer + Clean Code
    Ceramic Coffee Mug (Set of 2) + Indian Cookbook
- anomalies: one ~8x spike day, one near-zero (dead) day
- repeat rhythms: 15% "regulars" with 3x order weight

All docs get isSynthetic: true. The script deletes previous synthetic docs
first, so it is safe to re-run. Real users/orders are never touched.

Usage (from shop/):
    analytics/venv/Scripts/python -m analytics.generate_fake_orders [--users 500] [--orders 9000] [--seed 42]
"""

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pymongo import MongoClient

from .config import MONGODB_URI, db_name

PERSONAS = ("tech", "bookworm", "home", "bargain")
PERSONA_CATEGORY = {"tech": "Electronics", "bookworm": "Books", "home": "Home"}
# Frequency signature: bargain orders often but tiny baskets; home rarely but
# big baskets; bookworms steady; tech frequent. Gives RFM something real to find.
PERSONA_WEIGHT = {"tech": 1.3, "bookworm": 0.8, "home": 0.7, "bargain": 3.0}
PERSONA_BASKET = {
    "tech": ([1, 2, 3], [0.5, 0.35, 0.15]),
    "bookworm": ([1, 2, 3], [0.55, 0.3, 0.15]),
    "home": ([2, 3, 4], [0.4, 0.4, 0.2]),
    "bargain": ([1, 2], [0.7, 0.3]),
}

PLANTED_PAIRS = [
    ("Wireless Mouse", "Mechanical Keyboard"),
    ("The Pragmatic Programmer", "Clean Code"),
    ("Ceramic Coffee Mug (Set of 2)", "Indian Cookbook"),
]
PAIR_ATTACH_PROB = 0.4  # deliberately-bought-together items ride along often

FIRST = ["Aarav", "Diya", "Kabir", "Meera", "Arjun", "Ishita", "Rohan", "Priya",
         "Vikram", "Anaya", "Aditya", "Kavya", "Nikhil", "Shreya", "Farhan", "Pooja"]
LAST = ["Sharma", "Patel", "Reddy", "Iyer", "Khan", "Gupta", "Nair", "Singh",
        "Das", "Kulkarni", "Mehta", "Joshi", "Chopra", "Bose", "Rao", "Menon"]

DUMMY_HASH = "$2b$10$synthetic-no-login-" + "0" * 31  # never used to log in


def build_day_weights(n_days: int, start_weekday: int, festive_months=(9, 10)):
    """Weight per day offset: weekend rhythm x festive spike x growth trend.

    start_weekday is the real weekday of day 0 (Monday=0..Sunday=6), so the
    weekend multipliers land on actual Saturdays/Sundays.
    """
    weights = []
    for d in range(n_days):
        dow = (start_weekday + d) % 7
        w = 1.0
        if dow == 5:  # Saturday
            w *= 1.9
        elif dow == 6:  # Sunday
            w *= 1.7
        elif dow == 4:  # Friday
            w *= 1.2
        month = (d // 30) % 12  # cyclical: festive returns every 12 months
        if month in festive_months:
            w *= 2.5
        w *= 1.0 + 0.06 * (d // 30)  # gentle growth compounding across years
        weights.append(w)
    return weights


def weighted_day(rng: random.Random, weights, dead_day: int) -> int:
    while True:
        d = rng.choices(range(len(weights)), weights=weights, k=1)[0]
        if d != dead_day:
            return d


def pick_items(rng: random.Random, persona: str, by_category, by_name, cheapest):
    """1-4 items biased to the persona's taste + planted-pair attach."""
    sizes, size_w = PERSONA_BASKET[persona]
    n_items = rng.choices(sizes, weights=size_w)[0]
    if persona in PERSONA_CATEGORY:
        pool = by_category[PERSONA_CATEGORY[persona]]
        other = [p for p in sum(by_category.values(), []) if p not in pool]
        items = [rng.choice(pool) if rng.random() < 0.7 else rng.choice(other or pool)
                 for _ in range(n_items)]
    else:  # bargain hunter: cheapest products anywhere
        items = [rng.choice(cheapest) for _ in range(n_items)]

    # planted pairs: buying A pulls B into the basket
    names = {p["name"] for p in items}
    for a, b in PLANTED_PAIRS:
        if a in names and b not in names and b in by_name and rng.random() < PAIR_ATTACH_PROB:
            items.append(by_name[b])
    return items


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=500)
    ap.add_argument("--orders", type=int, default=9000)
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--spike-orders", type=int, default=120,
                    help="extra orders injected on the anomaly spike day")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    client = MongoClient(MONGODB_URI)
    db = client[db_name()]
    products = list(db.products.find({"isActive": True}))
    if len(products) < 20:
        raise SystemExit(f"Need the expanded catalog (found {len(products)}). Run npm run seed first.")

    by_category: dict[str, list] = {}
    for p in products:
        by_category.setdefault(p["category"], []).append(p)
    by_name = {p["name"]: p for p in products}
    cheapest = sorted(products, key=lambda p: p["price"])[:12]

    # sanity: planted pair products must exist
    missing = [n for pair in PLANTED_PAIRS for n in pair if n not in by_name]
    if missing:
        raise SystemExit(f"Planted-pair products missing from catalog: {missing}")

    n_days = args.months * 30
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=n_days)
    weights = build_day_weights(n_days, start.weekday())
    spike_day = 300 if n_days > 310 else n_days - 30
    dead_day = 150 if n_days > 160 else n_days // 2

    # ---- users ----
    user_weights = []
    user_docs = []
    personas = []
    for i in range(args.users):
        persona = PERSONAS[i % len(PERSONAS)]  # even split across personas
        regular = rng.random() < 0.15
        w = PERSONA_WEIGHT[persona] * (2.0 if regular else 1.0)
        user_weights.append(w)
        personas.append((persona, regular))
        user_docs.append(
            {
                "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                "email": f"synthetic-{i:04d}@example.com",
                "passwordHash": DUMMY_HASH,
                "role": "customer",
                "address": {},
                "persona": persona,
                "isSynthetic": True,
                "createdAt": start + timedelta(days=rng.randint(0, 10)),
                "updatedAt": start + timedelta(days=rng.randint(0, 10)),
            }
        )

    # ---- orders ----
    order_docs = []
    for _ in range(args.orders):
        u = rng.choices(range(args.users), weights=user_weights, k=1)[0]
        persona, _ = personas[u]
        d = weighted_day(rng, weights, dead_day)
        items = pick_items(rng, persona, by_category, by_name, cheapest)
        ts = start + timedelta(days=d, seconds=rng.randint(0, 86399))
        snap = [
            {
                "productId": p["_id"],
                "name": p["name"],
                "category": p["category"],
                "unitPrice": int(p["price"]),
                "quantity": rng.choices([1, 1, 1, 2, 3], k=1)[0],
            }
            for p in items
        ]
        subtotal = sum(s["unitPrice"] * s["quantity"] for s in snap)
        order_docs.append(
            {
                "userId": None,  # patched after user insert
                "_userIdx": u,
                "items": snap,
                "subtotal": subtotal,
                "total": subtotal,
                "status": "placed",
                "shippingAddress": {},
                "isSynthetic": True,
                "createdAt": ts,
            }
        )

    # anomaly: spike day injection (random users/items, midday burst)
    spike_ts = start + timedelta(days=spike_day)
    for _ in range(args.spike_orders):
        u = rng.randrange(args.users)
        persona, _ = personas[u]
        items = pick_items(rng, persona, by_category, by_name, cheapest)
        snap = [
            {
                "productId": p["_id"],
                "name": p["name"],
                "category": p["category"],
                "unitPrice": int(p["price"]),
                "quantity": rng.randint(1, 2),
            }
            for p in items
        ]
        subtotal = sum(s["unitPrice"] * s["quantity"] for s in snap)
        order_docs.append(
            {
                "userId": None,
                "_userIdx": u,
                "items": snap,
                "subtotal": subtotal,
                "total": subtotal,
                "status": "placed",
                "shippingAddress": {},
                "isSynthetic": True,
                "createdAt": spike_ts + timedelta(seconds=rng.randint(36000, 72000)),
            }
        )

    # ---- write (synthetic only) ----
    db.users.delete_many({"isSynthetic": True})
    db.orders.delete_many({"isSynthetic": True})
    user_ids = db.users.insert_many(
        [{k: v for k, v in u.items()} for u in user_docs]
    ).inserted_ids
    for o in order_docs:
        o["userId"] = user_ids[o.pop("_userIdx")]
    db.orders.insert_many(order_docs)

    truth = {
        "seed": args.seed,
        "months": args.months,
        "users": args.users,
        "orders": len(order_docs),
        "personas": list(PERSONAS),
        "plantedPairs": [{"a": a, "b": b, "attachProb": PAIR_ATTACH_PROB} for a, b in PLANTED_PAIRS],
        "festiveMonths": [9, 10],
        "weekendMultipliers": {"fri": 1.2, "sat": 1.9, "sun": 1.7},
        "spikeDay": spike_ts.date().isoformat(),
        "spikeOrdersInjected": args.spike_orders,
        "deadDay": (start + timedelta(days=dead_day)).date().isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    out = Path(__file__).resolve().parent / "planted_truth.json"
    out.write_text(json.dumps(truth, indent=2))
    print(f"Inserted {len(user_docs)} synthetic users, {len(order_docs)} synthetic orders.")
    print(f"Planted truth -> {out}")
    print(f"  spike day: {truth['spikeDay']} (+{args.spike_orders} orders), dead day: {truth['deadDay']}")
    client.close()


if __name__ == "__main__":
    main()
