"""Level A: descriptive analytics over order items (no ML yet).

All functions take the item-grain DataFrame from data.load_orders() and
return plain dicts/frames. run_all.py prints a human-readable summary.
"""

import pandas as pd


def _order_totals(items: pd.DataFrame) -> pd.DataFrame:
    """Collapse item rows to one row per order."""
    g = items.groupby("orderId").agg(
        userId=("userId", "first"),
        createdAt=("createdAt", "min"),
        total=("lineTotal", "sum"),
        lines=("name", "size"),
    )
    return g.reset_index()


def kpis(items: pd.DataFrame) -> dict:
    if items.empty:
        return {"revenue": 0, "orders": 0, "aov": 0.0, "repeatRate": 0.0, "customers": 0}
    orders = _order_totals(items)
    per_user = orders.groupby("userId").size()
    return {
        "revenue": int(items["lineTotal"].sum()),
        "orders": int(orders["orderId"].nunique()),
        "aov": round(float(orders["total"].mean()), 2),
        "repeatRate": round(float((per_user > 1).mean()), 4),
        "customers": int(orders["userId"].nunique()),
    }


def revenue_series(items: pd.DataFrame, freq: str = "W") -> pd.DataFrame:
    """Revenue + order counts per period (freq: D/W/ME)."""
    if items.empty:
        return pd.DataFrame()
    orders = _order_totals(items).set_index("createdAt").sort_index()
    rev = orders["total"].resample(freq).sum().rename("revenue")
    cnt = orders["total"].resample(freq).size().rename("orders")
    out = pd.concat([rev, cnt], axis=1).fillna(0)
    out["orders"] = out["orders"].astype(int)
    out["revenue"] = out["revenue"].astype(int)
    return out


def top_products(items: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    if items.empty:
        return pd.DataFrame()
    g = items.groupby(["productId", "name", "category"]).agg(
        units=("quantity", "sum"), revenue=("lineTotal", "sum"), orders=("orderId", "nunique")
    )
    return g.reset_index().sort_values("revenue", ascending=False).head(n)


def top_categories(items: pd.DataFrame) -> pd.DataFrame:
    if items.empty:
        return pd.DataFrame()
    g = items.groupby("category").agg(
        units=("quantity", "sum"), revenue=("lineTotal", "sum"), orders=("orderId", "nunique")
    )
    out = g.reset_index().sort_values("revenue", ascending=False)
    out["share"] = (out["revenue"] / out["revenue"].sum()).round(4)
    return out


def dow_pattern(items: pd.DataFrame) -> pd.DataFrame:
    """Orders + revenue by day of week (Monday-first)."""
    if items.empty:
        return pd.DataFrame()
    orders = _order_totals(items)
    orders["dow"] = orders["createdAt"].dt.day_name()
    g = orders.groupby("dow").agg(orders=("orderId", "nunique"), revenue=("total", "sum"))
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    out = g.reindex(order).fillna(0)
    out["orders"] = out["orders"].astype(int)
    out["revenue"] = out["revenue"].astype(int)
    return out


def summarize(items: pd.DataFrame) -> str:
    k = kpis(items)
    lines = [
        f"orders={k['orders']} customers={k['customers']} revenue={k['revenue']} paise "
        f"aov={k['aov']} repeatRate={k['repeatRate']}",
        "",
        "top categories:",
    ]
    cats = top_categories(items)
    for _, r in cats.iterrows():
        lines.append(f"  {r['category']}: revenue={int(r['revenue'])} share={r['share']}")
    lines += ["", "top products:"]
    for _, r in top_products(items, 5).iterrows():
        lines.append(f"  {r['name']} ({r['category']}): units={int(r['units'])} revenue={int(r['revenue'])}")
    lines += ["", "day-of-week orders:"]
    dow = dow_pattern(items)
    for day, r in dow.iterrows():
        lines.append(f"  {day}: orders={int(r['orders'])} revenue={int(r['revenue'])}")
    weekly = revenue_series(items, "W")
    if not weekly.empty:
        lines += ["", f"weekly revenue: last4={[int(v) for v in weekly['revenue'].tail(4)]}"]
    return "\n".join(lines)
