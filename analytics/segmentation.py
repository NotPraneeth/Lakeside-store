"""Customer segmentation: RFM + K-Means -> analytics_segments.

R = days since last order (vs latest order in data, UTC)
F = number of orders
M = total spend in paise (integers, never floats)

k is chosen from 3..6 by silhouette score (StandardScaler, fixed seed).
Cluster names are OUR interpretation of each cluster's mean R/F/M — the
algorithm only groups. Validation vs planted personas uses adjusted Rand
index (synthetic users carry a persona label).
"""

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import StandardScaler


def compute_rfm(items: pd.DataFrame) -> pd.DataFrame:
    orders = (
        items.groupby("orderId")
        .agg(userId=("userId", "first"), createdAt=("createdAt", "min"), total=("lineTotal", "sum"))
        .reset_index()
    )
    ref = orders["createdAt"].max()
    rfm = orders.groupby("userId").agg(
        lastOrder=("createdAt", "max"),
        frequency=("orderId", "nunique"),
        monetary=("total", "sum"),
    )
    rfm["recency"] = (ref - rfm["lastOrder"]).dt.total_seconds() / 86400.0
    return rfm.reset_index()[["userId", "recency", "frequency", "monetary"]]


def suggest_name(r: float, f: float, m: float, r_med: float, f_med: float, m_med: float) -> str:
    recent = r < r_med
    frequent = f >= max(2.0, f_med)
    big = m >= m_med
    if recent and f >= 2 * max(2.0, f_med) and big:
        return "Champions"
    if recent and frequent and big:
        return "Loyal big spenders"
    if recent and frequent:
        return "Loyal regulars"
    if recent and f <= 2:
        return "New customers"
    if not recent and frequent:
        return "At-risk regulars"
    if not recent and not frequent:
        return "Dormant one-timers"
    if big:
        return "Occasional big spenders"
    return "Occasional buyers"


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str) -> dict:
    rfm = compute_rfm(items)
    # log1p(monetary): spend is heavy-tailed; raw paise lets a few whales
    # dictate the clusters. Stored values stay raw — this is scaling only.
    X = np.column_stack([
        rfm["recency"].to_numpy(dtype=float),
        rfm["frequency"].to_numpy(dtype=float),
        np.log1p(rfm["monetary"].to_numpy(dtype=float)),
    ])
    Xs = StandardScaler().fit_transform(X)

    tried = {}
    for k in (3, 4, 5, 6):
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(Xs)
        sil = silhouette_score(Xs, labels) if k < len(Xs) else -1.0
        tried[k] = (sil, labels)
    best_sil = max(s for s, _ in tried.values())
    # smallest k within 95% of the best silhouette AND no sliver clusters
    # (dashboard segments must each hold >=5% of customers)
    min_size = max(10, int(0.05 * len(Xs)))
    eligible = [k for k, (s, lab) in tried.items()
                if s >= 0.95 * best_sil and (pd.Series(lab).value_counts().min() >= min_size)]
    if not eligible:  # fall back rather than fail
        eligible = [max(tried, key=lambda k: tried[k][0])]
    k = min(eligible)
    sil, labels = tried[k]
    rfm["cluster"] = labels
    best = (k, sil, labels)

    means = rfm.groupby("cluster")[["recency", "frequency", "monetary"]].mean()
    r_med, f_med, m_med = rfm["recency"].median(), rfm["frequency"].median(), rfm["monetary"].median()
    names = {}
    used: dict[str, int] = {}
    for c, m in means.iterrows():
        base = suggest_name(m["recency"], m["frequency"], m["monetary"], r_med, f_med, m_med)
        used[base] = used.get(base, 0) + 1
        names[c] = base if used[base] == 1 else f"{base} #{used[base]}"
    rfm["segment"] = rfm["cluster"].map(names)
    sizes = rfm["segment"].value_counts().to_dict()

    # stability: same pipeline, different seed — clusters should barely move
    km2 = KMeans(n_clusters=k, n_init=10, random_state=7).fit_predict(Xs)
    stability = round(float(adjusted_rand_score(labels, km2)), 4)

    # validation vs planted personas (synthetic users only)
    ari = None
    if not users.empty and "persona" in users.columns:
        umap = dict(zip(users["userId"], users["persona"]))
        truth, pred = [], []
        for _, row in rfm.iterrows():
            p = umap.get(row["userId"])
            if p:
                truth.append(p)
                pred.append(row["cluster"])
        if len(set(truth)) > 1:
            ari = round(float(adjusted_rand_score(truth, pred)), 4)

    now = datetime.now(timezone.utc)
    docs = [
        {
            "userId": row["userId"],
            "recencyDays": round(float(row["recency"]), 2),
            "frequency": int(row["frequency"]),
            "monetary": int(row["monetary"]),
            "cluster": int(row["cluster"]),
            "segment": row["segment"],
            "runId": run_id,
            "generatedAt": now,
        }
        for _, row in rfm.iterrows()
    ]
    segs = cols["analytics_segments"]
    segs.delete_many({"runId": run_id})
    if docs:
        segs.insert_many(docs)
    segs.insert_one(
        {
            "type": "kmeans_meta",
            "k": k,
            "silhouette": round(float(sil), 4),
            "sizes": sizes,
            "clusterMeans": {
                str(c): {"recency": round(float(m["recency"]), 1),
                         "frequency": round(float(m["frequency"]), 2),
                         "monetary": int(m["monetary"]),
                         "segment": names[c]}
                for c, m in means.iterrows()
            },
            "stabilityARI": stability,
            "adjustedRandVsPersona": ari,
            "runId": run_id,
            "generatedAt": now,
        }
    )
    summary = {"k": k, "silhouette": round(float(sil), 4), "sizes": sizes,
               "stability": stability, "ariVsPersona": ari}
    print(f"[segmentation] k={k} silhouette={summary['silhouette']} stability={stability} ariVsPersona={ari}")
    for seg, n in sizes.items():
        print(f"  {seg}: {n}")
    return summary
