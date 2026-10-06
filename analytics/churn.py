"""Repeat-purchase rhythm / churn risk -> flags on analytics_segments.

Per customer: median gap between orders. Flagged "at risk" when days since
the last order exceed 2x their usual gap (min 30 days grace). Single-order
customers are compared against 2x the GLOBAL median gap instead.
"""

from datetime import datetime, timezone

import pandas as pd


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str) -> dict:
    orders = (
        items.groupby("orderId")
        .agg(userId=("userId", "first"), createdAt=("createdAt", "min"))
        .reset_index()
        .sort_values("createdAt")
    )
    ref = orders["createdAt"].max()
    gaps = orders.groupby("userId")["createdAt"].apply(
        lambda s: s.sort_values().diff().dt.total_seconds().div(86400).median()
    )
    last = orders.groupby("userId")["createdAt"].max()
    freq = orders.groupby("userId").size()
    global_gap = float(gaps.median())

    segs = cols["analytics_segments"]
    at_risk = 0
    for user_id in freq.index:
        f = int(freq[user_id])
        since = (ref - last[user_id]).total_seconds() / 86400.0
        usual = float(gaps[user_id]) if f >= 2 and pd.notna(gaps[user_id]) else global_gap
        risk = since > max(2 * usual, 30.0)
        at_risk += int(risk)
        segs.update_many(
            {"userId": user_id, "runId": run_id},
            {
                "$set": {
                    "medianGapDays": round(usual, 1),
                    "daysSinceLastOrder": round(float(since), 1),
                    "atRisk": bool(risk),
                }
            },
        )

    now = datetime.now(timezone.utc)
    segs.insert_one(
        {"type": "churn_meta", "atRiskCount": at_risk,
         "runId": run_id, "generatedAt": now}
    )
    summary = {"atRisk": at_risk, "customers": int(len(freq))}
    print(f"[churn] at-risk customers: {at_risk}/{len(freq)}")
    return summary
