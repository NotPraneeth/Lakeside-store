"""Frequently bought together: support / confidence / lift -> analytics_pairs.

Each order is a basket of product names. For every unordered pair {A, B}:
- support    = P(A and B)            (fraction of baskets containing both)
- conf(A->B) = P(B | A)
- lift       = P(A and B) / (P(A) * P(B));  >1 means a real association

Pairs with fewer than MIN_COUNT baskets are dropped as noise.
"""

from datetime import datetime, timezone
from itertools import combinations

import pandas as pd

MIN_SUPPORT = 0.002  # relative support: pairs must appear in >=0.2% of baskets


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str,
        min_support: float = MIN_SUPPORT) -> dict:
    baskets = items.groupby("orderId")["name"].apply(lambda s: sorted(set(s))).tolist()
    n = len(baskets)
    min_count = max(2, int(n * min_support))
    single: dict[str, int] = {}
    pair: dict[tuple[str, str], int] = {}
    for b in baskets:
        for name in b:
            single[name] = single.get(name, 0) + 1
        for a, b_ in combinations(b, 2):
            pair[(a, b_)] = pair.get((a, b_), 0) + 1

    meta = items.groupby("name").agg(
        productId=("productId", "first"), category=("category", "first")
    ).to_dict("index")

    rows = []
    for (a, b), c in pair.items():
        if c < min_count:
            continue
        pa, pb = single[a] / n, single[b] / n
        pab = c / n
        lift = pab / (pa * pb) if pa and pb else 0.0
        if lift < 1.0:
            continue  # negative / chance associations aren't "bought together"
        rows.append(
            {
                "a": {"name": a, **meta.get(a, {})},
                "b": {"name": b, **meta.get(b_, {})},
                "count": c,
                "support": round(pab, 5),
                "confidenceAB": round(c / single[a], 4),
                "confidenceBA": round(c / single[b_], 4),
                "lift": round(lift, 3),
            }
        )
    rows.sort(key=lambda r: (-r["lift"], -r["count"]))

    now = datetime.now(timezone.utc)
    coll = cols["analytics_pairs"]
    coll.delete_many({"runId": run_id})
    if rows:
        coll.insert_many([{**r, "runId": run_id, "generatedAt": now} for r in rows])

    print(f"[pairs] {len(rows)} pairs (min_count={min_count}, baskets={n}); top by lift:")
    for r in rows[:8]:
        print(f"  {r['a']['name']} + {r['b']['name']}: lift={r['lift']} n={r['count']}")
    return {"pairs": len(rows), "top": [(r["a"]["name"], r["b"]["name"], r["lift"]) for r in rows[:10]]}
