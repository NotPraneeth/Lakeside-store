"""Anomaly detection: rolling z-score (+ Isolation Forest) -> analytics_anomalies.

Flags days whose orders or revenue sit far from their trailing 14-day
average. These are CANDIDATES to investigate — the code cannot know the
cause (sale? outage? festival?).
"""

from datetime import datetime, timezone

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from .trends import daily_series

WINDOW = 14
Z_THRESH = 3.0


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str) -> dict:
    daily = daily_series(items)
    roll = daily[["orders", "revenue"]].rolling(WINDOW, min_periods=7)
    z = (daily[["orders", "revenue"]] - roll.mean()) / roll.std().replace(0, float("nan"))

    Xs = StandardScaler().fit_transform(daily[["orders", "revenue"]].astype(float))
    iso = IsolationForest(contamination=0.02, random_state=42).fit_predict(Xs)

    flags = []
    for i, (day, row) in enumerate(daily.iterrows()):
        zo, zr = z["orders"].iloc[i], z["revenue"].iloc[i]
        reasons = []
        if pd.notna(zo) and abs(zo) >= Z_THRESH:
            reasons.append(f"orders z={zo:+.1f}")
        if pd.notna(zr) and abs(zr) >= Z_THRESH:
            reasons.append(f"revenue z={zr:+.1f}")
        if iso[i] == -1:
            reasons.append("isolation-forest")
        if reasons:
            flags.append(
                {
                    "day": day.to_pydatetime(),
                    "orders": int(row["orders"]),
                    "revenue": int(row["revenue"]),
                    "zOrders": round(float(zo), 2) if pd.notna(zo) else None,
                    "zRevenue": round(float(zr), 2) if pd.notna(zr) else None,
                    "reasons": reasons,
                }
            )

    now = datetime.now(timezone.utc)
    coll = cols["analytics_anomalies"]
    coll.delete_many({"runId": run_id})
    if flags:
        coll.insert_many([{**f, "runId": run_id, "generatedAt": now} for f in flags])

    print(f"[anomalies] {len(flags)} flagged days (z>={Z_THRESH}, window={WINDOW}d):")
    for f in sorted(flags, key=lambda x: x["day"])[:12]:
        print(f"  {f['day'].date()}: orders={f['orders']} revenue={f['revenue']} ({'; '.join(f['reasons'])})")
    return {"flags": len(flags), "days": [f["day"].date().isoformat() for f in flags]}
