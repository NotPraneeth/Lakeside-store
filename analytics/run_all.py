"""Run the analytics pipeline end to end.

Slice A: descriptive. Slice B: ML (segments, pairs, trends, forecast,
anomalies, churn) + validation vs planted truth. Slice C (LLM + dashboard)
hooks in later.

Usage (from shop/):
    analytics/venv/Scripts/python -m analytics.run_all [--no-synthetic]
"""

import argparse
from datetime import datetime, timezone

from . import anomalies, churn, descriptive, forecast, funnel, pairs, segmentation, trends, validate
from .config import db_name
from .data import get_client, get_collections, load_events, load_orders, load_users


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-synthetic", action="store_true",
                    help="analyse real orders only (default includes synthetic)")
    args = ap.parse_args()

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    print(f"runId={run_id}")

    client = get_client()
    try:
        cols = get_collections(client)
        db = client[db_name()]
        for name in ("analytics_segments", "analytics_pairs",
                     "analytics_trends", "analytics_anomalies",
                     "analytics_funnel", "insights"):
            cols[name] = db[name]

        items = load_orders(cols["orders"], include_synthetic=not args.no_synthetic)
        users = load_users(cols["users"], include_synthetic=not args.no_synthetic)
        events = load_events(cols["events"], include_synthetic=not args.no_synthetic)
    finally:
        pass  # keep client open; modules share it

    print(f"loaded {len(items)} order-item rows (include_synthetic={not args.no_synthetic})")
    print()
    print(descriptive.summarize(items))
    print()

    segmentation.run(items, users, cols, run_id)
    pairs.run(items, users, cols, run_id)
    trends.run(items, users, cols, run_id)
    forecast.run(items, users, cols, run_id)
    anomalies.run(items, users, cols, run_id)
    churn.run(items, users, cols, run_id)
    if not events.empty:
        funnel.run(items, users, events, cols, run_id)
    else:
        print("[funnel] no events — skipping (browse the store or run generate_fake_events)")

    validate.run(cols, run_id, items, events)

    # prune old runs (keep 3): without this every run appends ~12k docs.
    # `insights` is never pruned — its cache relies on inputHash, not runId.
    try:
        metas = list(cols["analytics_segments"].find(
            {"type": "kmeans_meta"}, {"runId": 1}).sort("generatedAt", -1))
        keep = {m["runId"] for m in metas[:3]}
        for name in ("analytics_segments", "analytics_pairs", "analytics_trends",
                     "analytics_anomalies", "analytics_funnel"):
            cols[name].delete_many({"runId": {"$nin": list(keep)}})
    except Exception as err:
        print(f"[prune] skipped ({err})")
    client.close()


if __name__ == "__main__":
    main()
