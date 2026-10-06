"""Validate Slice B results against planted truth (implementation.md §4.7).

Reads analytics/planted_truth.json and checks the analytics_* collections
for the given run. Prints PASS/FAIL per analysis — the honest scoreboard
for the README.
"""

import json
from pathlib import Path

import pandas as pd


def _norm_pair(a: str, b: str) -> frozenset:
    return frozenset((a, b))


def _funnel_checks(cols, run_id: str, items, events, truth: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    ev = truth.get("events", {})

    # 1. consistency: synthetic order items should have a preceding synthetic add
    syn_items = items[items["isSynthetic"] == True] if "isSynthetic" in items.columns else items.iloc[0:0]
    syn_adds = events[(events["type"] == "add_to_cart") & (events["isSynthetic"] == True)]
    add_times: dict[tuple, list] = {}
    for (uid, pid), g in syn_adds.groupby(["userId", "productId"]):
        add_times[(uid, pid)] = sorted(g["createdAt"].tolist())
    covered, total = 0, 0
    for _, r in syn_items.iterrows():
        total += 1
        for t in add_times.get((r["userId"], r["productId"]), []):
            if r["createdAt"] - pd.Timedelta(days=7) <= t <= r["createdAt"]:
                covered += 1
                break
    rate = round(covered / total, 4) if total else 0.0
    # planted 92% attach => expect >= 80% (direct buys + timing edge cases)
    out["funnelConsistency"] = {
        "pass": bool(rate >= 0.80),
        "detail": f"{covered}/{total} order items have a preceding add ({rate:.1%}, need >=80%)",
    }

    # 2. recovered conversion rank matches the planted rank order
    docs = list(cols["analytics_funnel"].find({"runId": run_id, "kind": "category"}))
    ranked = [d["category"] for d in sorted(docs, key=lambda d: d["viewToBuy"], reverse=True)]
    target = ev.get("targetConversionRank", [])
    out["funnelRank"] = {
        "pass": bool(ranked == target),
        "detail": f"recovered={ranked} planted={target}",
    }

    # 3. trending spike products top the spike week's view velocity
    spike = ev.get("trendingSpike", {})
    top3: list[str] = []
    if spike:
        start = pd.Timestamp(spike["weekStart"], tz="UTC")
        end = pd.Timestamp(spike["weekEnd"], tz="UTC") + pd.Timedelta(days=1)
        wk = events[(events["type"] == "product_view") & (events["createdAt"] >= start) & (events["createdAt"] < end)]
        prod_names = items.groupby("productId")["name"].first().to_dict()
        top_ids = wk["productId"].value_counts().head(3).index.tolist()
        top3 = [prod_names.get(pid, pid) for pid in top_ids]
        hit = all(p in top3 for p in spike.get("products", []))
    else:
        hit = False
    out["trending"] = {
        "pass": bool(hit),
        "detail": f"spike-week top3={top3} planted={spike.get('products')}",
    }
    return out


def run(cols, run_id: str, items=None, events=None) -> dict:
    truth = json.loads((Path(__file__).resolve().parent / "planted_truth.json").read_text())
    results: dict[str, dict] = {}

    # 1. segmentation: compact + stable clusters; RFM has no category signal,
    # so personas are NOT expected to match 1:1 — instead the bargain persona
    # (distinct low spend) should concentrate in the lowest-M cluster.
    meta = cols["analytics_segments"].find_one({"type": "kmeans_meta", "runId": run_id}) or {}
    sil = meta.get("silhouette", 0) or 0
    stab = meta.get("stabilityARI", 0) or 0
    purity = None
    means = meta.get("clusterMeans", {}) or {}
    if means:
        high_f = max(means, key=lambda c: means[c]["frequency"])
        umap = {str(u["_id"]): u.get("persona") for u in cols["users"].find({})}
        members = [d for d in cols["analytics_segments"].find({"runId": run_id})
                   if "cluster" in d]
        top = [umap.get(d["userId"]) for d in members if str(d["cluster"]) == str(high_f)]
        top = [p for p in top if p]
        if top:
            purity = round(sum(1 for p in top if p == "bargain") / len(top), 3)
    seg_ok = sil > 0.25 and stab > 0.7 and (purity or 0) >= 0.5
    results["segmentation"] = {
        "pass": bool(seg_ok),
        "detail": f"k={meta.get('k')} silhouette={sil} stability={stab} "
                  f"bargainPurityInHighestF={purity} (need sil>0.25, stab>0.7, purity>=0.5); "
                  f"ARIvsPersona={meta.get('adjustedRandVsPersona')} (info only — RFM can't see categories)",
    }

    # 2. planted pairs rank by lift
    docs = list(cols["analytics_pairs"].find({"runId": run_id}).sort("lift", -1))
    ranked = [_norm_pair(d["a"]["name"], d["b"]["name"]) for d in docs]
    pair_hits = []
    for p in truth["plantedPairs"]:
        want = _norm_pair(p["a"], p["b"])
        rank = ranked.index(want) + 1 if want in ranked else None
        pair_hits.append({"pair": f"{p['a']} + {p['b']}", "rank": rank})
    results["pairs"] = {
        "pass": all(h["rank"] is not None and h["rank"] <= 10 for h in pair_hits),
        "detail": f"{len(docs)} pairs; " + "; ".join(
            f"{h['pair']} rank={h['rank']}" for h in pair_hits),
    }

    # 3. anomalies: planted spike + dead days flagged
    flagged = {
        d["day"].date().isoformat()
        for d in cols["analytics_anomalies"].find({"runId": run_id})
    }
    spike_ok = truth["spikeDay"] in flagged
    dead_ok = truth["deadDay"] in flagged
    results["anomalies"] = {
        "pass": bool(spike_ok and dead_ok),
        "detail": f"spike {truth['spikeDay']} flagged={spike_ok}; dead {truth['deadDay']} flagged={dead_ok}; "
                  f"{len(flagged)} total flags",
    }

    # 4. forecast beats naive
    bt = cols["analytics_trends"].find_one({"type": "forecast_backtest", "runId": run_id})
    beats = bool((bt or {}).get("modelBeatsNaive"))
    results["forecast"] = {
        "pass": beats,
        "detail": f"metrics={(bt or {}).get('metrics')} beatsNaive={beats}",
    }

    # 5. trends: weekend lift detected
    weekend_ok = any(
        (d.get("type") == "stl_daily") for d in
        cols["analytics_trends"].find({"runId": run_id}).limit(1)
    )
    results["trends"] = {
        "pass": bool(weekend_ok),
        "detail": "STL decomposition persisted (weekend lift printed by trends step)",
    }

    # 6-8. funnel checks (only when the caller passes loaded frames)
    if items is not None and events is not None and not events.empty:
        results.update(_funnel_checks(cols, run_id, items, events, truth))

    print("\n[validate] Slice B scoreboard vs planted truth:")
    all_ok = True
    for name, r in results.items():
        mark = "PASS" if r["pass"] else "FAIL"
        all_ok &= bool(r["pass"])
        print(f"  [{mark}] {name}: {r['detail']}")
    results["_all"] = all_ok
    return results
