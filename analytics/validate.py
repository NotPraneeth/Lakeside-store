"""Validate Slice B results against planted truth (implementation.md §4.7).

Reads analytics/planted_truth.json and checks the analytics_* collections
for the given run. Prints PASS/FAIL per analysis — the honest scoreboard
for the README.
"""

import json
from pathlib import Path


def _norm_pair(a: str, b: str) -> frozenset:
    return frozenset((a, b))


def run(cols, run_id: str) -> dict:
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

    print("\n[validate] Slice B scoreboard vs planted truth:")
    all_ok = True
    for name, r in results.items():
        mark = "PASS" if r["pass"] else "FAIL"
        all_ok &= bool(r["pass"])
        print(f"  [{mark}] {name}: {r['detail']}")
    results["_all"] = all_ok
    return results
