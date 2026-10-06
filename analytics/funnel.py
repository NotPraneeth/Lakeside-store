"""Funnel analytics: view -> cart -> buy conversion -> analytics_funnel.

Buys come from ORDERS (single source of truth), views/adds from EVENTS.
- per product / per category: views, adds, buys + view->add, add->buy, view->buy
- overall: same + cart-abandonment (adds with no same-product buy within 7d)
- search: top terms + search sessions ending in a purchase within 48h

Guest (user-less) views count toward views; linked conversions require userId.
"""

from datetime import datetime, timezone

import pandas as pd

BUY_WINDOW_DAYS = 7
SEARCH_WINDOW_HOURS = 48


def _buys(items: pd.DataFrame) -> pd.DataFrame:
    """One row per bought (user, product) pair with the earliest buy time."""
    b = items.groupby(["userId", "productId"]).agg(
        buyAt=("createdAt", "min"),
        buyQty=("quantity", "sum"),
        name=("name", "first"),
        category=("category", "first"),
    ).reset_index()
    return b


def _conversion(frames: dict[str, pd.DataFrame], by: str) -> pd.DataFrame:
    views, adds, buys = frames["views"], frames["adds"], frames["buys"]
    v = views.groupby(by).agg(views=("productId", "size"), viewers=("userId", "nunique")).reset_index()
    a = adds.groupby(by).agg(adds=("productId", "size"), adders=("userId", "nunique")).reset_index()
    b = buys.groupby(by).agg(buys=("buyQty", "sum"), buyers=("userId", "nunique")).reset_index()
    out = v.merge(a, on=by, how="outer").merge(b, on=by, how="outer").fillna(0)
    for c in ("views", "viewers", "adds", "adders", "buys", "buyers"):
        out[c] = out[c].astype(int)
    out["viewToAdd"] = (out["adds"] / out["views"].replace(0, float("nan"))).fillna(0).round(4)
    out["addToBuy"] = (out["buys"] / out["adds"].replace(0, float("nan"))).fillna(0).round(4)
    out["viewToBuy"] = (out["buys"] / out["views"].replace(0, float("nan"))).fillna(0).round(4)
    return out


def _abandonment(events: pd.DataFrame, items: pd.DataFrame) -> dict:
    adds = events[(events["type"] == "add_to_cart") & events["userId"].notna()].copy()
    if adds.empty:
        return {"adds": 0, "abandoned": 0, "abandonRate": 0.0}
    # all (user, product) order times — an add converts if ANY buy lands in its 7d window
    order_times: dict[tuple, list] = {}
    for (uid, pid), g in items.groupby(["userId", "productId"]):
        order_times[(uid, pid)] = sorted(g["createdAt"].tolist())
    abandoned = 0
    for _, a in adds.iterrows():
        converted = any(
            a["createdAt"] <= t <= a["createdAt"] + pd.Timedelta(days=BUY_WINDOW_DAYS)
            for t in order_times.get((a["userId"], a["productId"]), [])
        )
        abandoned += 0 if converted else 1
    return {"adds": len(adds), "abandoned": abandoned,
            "abandonRate": round(abandoned / len(adds), 4)}


def _search_stats(events: pd.DataFrame, items: pd.DataFrame) -> dict:
    searches = events[events["type"] == "search"].copy()
    top = searches["searchTerm"].value_counts().head(10).to_dict() if not searches.empty else {}
    linked = searches[searches["userId"].notna()]
    order_times = items.groupby("userId")["createdAt"].min().to_dict()
    converted = 0
    for _, s in linked.iterrows():
        first_order = order_times.get(s["userId"])
        if first_order is not None and s["createdAt"] <= first_order <= s["createdAt"] + pd.Timedelta(hours=SEARCH_WINDOW_HOURS):
            converted += 1
    return {
        "searches": len(searches),
        "topTerms": top,
        "searchToPurchase": round(converted / len(linked), 4) if len(linked) else 0.0,
    }


def run(items: pd.DataFrame, users: pd.DataFrame, events: pd.DataFrame, cols, run_id: str) -> dict:
    views = events[events["type"] == "product_view"].copy()
    adds = events[events["type"] == "add_to_cart"].copy()
    buys = _buys(items)
    prod_meta = items.groupby("productId").agg(name=("name", "first"), category=("category", "first")).to_dict("index")

    by_product = _conversion({"views": views, "adds": adds, "buys": buys}, by="productId")
    by_category = _conversion({"views": views, "adds": adds, "buys": buys}, by="category")
    overall = {
        "views": int(len(views)), "adds": int(len(adds)), "buys": int(buys["buyQty"].sum()),
        "viewToAdd": round(len(adds) / len(views), 4) if len(views) else 0.0,
        "viewToBuy": round(int(buys["buyQty"].sum()) / len(views), 4) if len(views) else 0.0,
    }
    abandon = _abandonment(events, items)
    search = _search_stats(events, items)

    now = datetime.now(timezone.utc)
    coll = cols["analytics_funnel"]
    coll.delete_many({"runId": run_id})
    docs = []
    for _, r in by_product.iterrows():
        meta = prod_meta.get(r["productId"], {})
        docs.append({"kind": "product", "productId": r["productId"], "name": meta.get("name"),
                     "category": meta.get("category"),
                     "views": int(r["views"]), "adds": int(r["adds"]), "buys": int(r["buys"]),
                     "viewToAdd": float(r["viewToAdd"]), "addToBuy": float(r["addToBuy"]),
                     "viewToBuy": float(r["viewToBuy"])})
    for _, r in by_category.iterrows():
        docs.append({"kind": "category", "category": r["category"],
                     "views": int(r["views"]), "adds": int(r["adds"]), "buys": int(r["buys"]),
                     "viewToAdd": float(r["viewToAdd"]), "addToBuy": float(r["addToBuy"]),
                     "viewToBuy": float(r["viewToBuy"])})
    docs.append({"kind": "overall", **overall, "abandonment": abandon})
    docs.append({"kind": "search", **search})
    coll.insert_many([{**d, "runId": run_id, "generatedAt": now} for d in docs])

    print(f"[funnel] views={overall['views']} adds={overall['adds']} buys={overall['buys']} "
          f"view->buy={overall['viewToBuy']:.2%} abandon={abandon['abandonRate']:.1%}")
    for _, r in by_category.sort_values("viewToBuy", ascending=False).iterrows():
        print(f"  {r['category']}: view->buy={r['viewToBuy']:.2%} (v={r['views']} a={r['adds']} b={r['buys']})")
    return {"overall": overall, "abandonRate": abandon["abandonRate"],
            "categoryRank": by_category.sort_values("viewToBuy", ascending=False)["category"].tolist()}
