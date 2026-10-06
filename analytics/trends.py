"""Trend + seasonality: STL decomposition -> analytics_trends.

Daily revenue is decomposed (period=7, robust) into trend + seasonal +
remainder, which exposes the planted weekly rhythm and festive spike.
Per-category monthly growth rates show what is rising or falling.
"""

from datetime import datetime, timezone

import pandas as pd
from statsmodels.tsa.seasonal import STL


def daily_series(items: pd.DataFrame) -> pd.DataFrame:
    orders = (
        items.groupby("orderId")
        .agg(createdAt=("createdAt", "min"), total=("lineTotal", "sum"))
        .reset_index()
    )
    orders["day"] = orders["createdAt"].dt.floor("D")
    g = orders.groupby("day").agg(revenue=("total", "sum"), orders=("orderId", "nunique"))
    full = pd.DataFrame(index=pd.date_range(g.index.min(), g.index.max(), freq="D"))
    out = full.join(g).fillna(0)
    out["orders"] = out["orders"].astype(int)
    out["revenue"] = out["revenue"].astype(int)
    return out


def category_monthly_growth(items: pd.DataFrame) -> pd.DataFrame:
    df = items.copy()
    df["createdAt"] = df["createdAt"].dt.tz_localize(None)
    df["month"] = df["createdAt"].dt.to_period("M").astype(str)
    g = df.groupby(["month", "category"])["lineTotal"].sum().reset_index()
    piv = g.pivot(index="month", columns="category", values="lineTotal").fillna(0).sort_index()
    # compare the last two FULL months (the trailing month is usually partial)
    full = piv.index[:-1] if len(piv) > 2 else piv.index
    growth = piv.loc[full].pct_change().iloc[-1].fillna(0).round(4)
    return pd.DataFrame({"month": full[-1], "category": growth.index, "momGrowth": growth.values})


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str) -> dict:
    daily = daily_series(items)
    stl = STL(daily["revenue"].astype(float), period=7, robust=True).fit()
    seasonal_strength = float(1 - stl.resid.var() / (stl.seasonal + stl.resid).var())

    now = datetime.now(timezone.utc)
    coll = cols["analytics_trends"]
    coll.delete_many({"runId": run_id, "type": {"$in": ["stl_daily", "category_growth"]}})

    stl_docs = [
        {
            "type": "stl_daily",
            "day": idx.to_pydatetime(),
            "revenue": int(row["revenue"]),
            "trend": round(float(t), 2),
            "seasonal": round(float(s), 2),
            "resid": round(float(r), 2),
            "runId": run_id,
            "generatedAt": now,
        }
        for (idx, row), t, s, r in zip(
            daily.iterrows(), stl.trend, stl.seasonal, stl.resid
        )
    ]
    if stl_docs:
        coll.insert_many(stl_docs)

    growth = category_monthly_growth(items)
    coll.insert_many(
        [
            {
                "type": "category_growth",
                "month": row["month"],
                "category": row["category"],
                "momGrowth": float(row["momGrowth"]),
                "runId": run_id,
                "generatedAt": now,
            }
            for _, row in growth.iterrows()
        ]
    )
    # weekend effect: mean seasonal component on Sat/Sun vs weekdays
    seas = pd.Series(stl.seasonal.values, index=daily.index)
    wknd = float(seas[seas.index.dayofweek >= 5].mean())
    wkdy = float(seas[seas.index.dayofweek < 5].mean())

    summary = {
        "days": len(daily),
        "seasonalStrength": round(seasonal_strength, 4),
        "weekendLift": int(wknd - wkdy),
        "growth": growth.sort_values("momGrowth", ascending=False).to_dict("records"),
    }
    print(f"[trends] days={summary['days']} seasonalStrength={summary['seasonalStrength']} "
          f"weekendLift={summary['weekendLift']} paise/day")
    for r in summary["growth"]:
        print(f"  {r['category']}: momGrowth={r['momGrowth']:+.1%}")
    return summary
