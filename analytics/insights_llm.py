"""LLM insights layer: Gemini writes the weekly owner summary (Slice C).

Golden rule: CODE computes the numbers; the LLM only explains them.
- facts: compact JSON assembled from analytics_* + orders (all money pre-
  formatted as exact ₹ strings; the model must copy them verbatim).
- number check: every headline figure must appear digit-for-digit in the
  reply, else fall back to a deterministic template summary.
- cache: sha256 of the facts; no regeneration (and no spend) when unchanged.
- privacy: aggregates only — never names, emails, or addresses.

Usage (from shop/):
    analytics/venv/Scripts/python -m analytics.insights_llm [--force] [--dry-run]

Needs GEMINI_API_KEY in the environment (analytics/.env, gitignored).
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone

from . import descriptive
from .config import GEMINI_API_KEY
from .data import get_client, get_collections, load_orders

MODEL = "gemini-flash-lite-latest"
# Cheap, low-intelligence models are fine for this job (facts are precomputed;
# the model only verbalizes). Tried in order on 503s.
FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemma-4-26b-a4b-it", "gemini-3-flash-preview"]


def _inr(paise: int) -> str:
    return f"\u20b9{int(round(paise / 100)):,}"


def _rs(paise) -> str:
    """Whole rupees, rounded — the SAME number _inr displays. Keys must match
    the display exactly (floor //100 differs by 1 when the fraction ≥ .5)."""
    return str(int(round(int(paise) / 100)))


def build_facts(cols, run_id: str | None) -> tuple[dict, list[str]]:
    """Facts JSON + the headline figures the reply must reproduce exactly."""
    items_df = load_orders(cols["orders"])
    k = descriptive.kpis(items_df)
    weekly = descriptive.revenue_series(items_df, "W")
    weekly_full = weekly[weekly["orders"] > 0]
    if len(weekly_full) > 2 and weekly_full["orders"].iloc[-1] < 0.4 * weekly_full["orders"].median():
        weekly_full = weekly_full.iloc[:-1]  # in-progress week is not a "full week"
    last2 = weekly_full.tail(2)["revenue"].tolist() if len(weekly_full) >= 2 else [0, 0]
    wow_pct = round((last2[1] - last2[0]) / last2[0] * 100, 1) if last2[0] else 0.0

    top3 = descriptive.top_products(items_df, 3)
    top3_facts = [
        {"name": r["name"], "units": int(r["units"]), "revenue": _inr(int(r["revenue"]))}
        for _, r in top3.iterrows()
    ]
    growth_docs = list(cols["analytics_trends"].find(
        {"type": "category_growth", **({"runId": run_id} if run_id else {})}))
    mover = max(growth_docs, key=lambda d: abs(d.get("momGrowth", 0))) if growth_docs else None
    meta = cols["analytics_segments"].find_one(
        {"type": "kmeans_meta", **({"runId": run_id} if run_id else {})},
        sort=[("generatedAt", -1)])
    anoms = list(cols["analytics_anomalies"].find(
        {"runId": run_id} if run_id else {}).sort("day", -1).limit(3))
    anom_count = cols["analytics_anomalies"].count_documents(
        {"runId": run_id} if run_id else {})
    fc = list(cols["analytics_trends"].find(
        {"type": "forecast_monthly", **({"runId": run_id} if run_id else {})}).sort("month", 1))
    funnel_overall = cols["analytics_funnel"].find_one(
        {"kind": "overall", **({"runId": run_id} if run_id else {})},
        sort=[("generatedAt", -1)])
    churn = cols["analytics_segments"].find_one(
        {"type": "churn_meta", **({"runId": run_id} if run_id else {})},
        sort=[("generatedAt", -1)])

    facts = {
        "totalRevenue": _inr(k["revenue"]),
        "totalOrders": k["orders"],
        "customers": k["customers"],
        "avgOrderValue": _inr(int(k["aov"])),
        "lastFullWeekRevenue": _inr(last2[1]),
        "previousWeekRevenue": _inr(last2[0]),
        "weekOverWeekPct": wow_pct,
        "topProducts": top3_facts,
        "biggestCategoryMover": (
            {"category": mover["category"], "month": mover["month"],
             "changePct": round(mover["momGrowth"] * 100, 1)} if mover else None),
        "segments": (meta or {}).get("sizes", {}),
        "anomalyDays": anom_count,
        "latestAnomaly": (
            {"day": anoms[0]["day"].date().isoformat(),
             "revenue": _inr(anoms[0]["revenue"])} if anoms else None),
        "forecastNext2Months": [{"month": f["month"], "revenue": _inr(f["forecastRevenue"])} for f in fc],
        "funnelViewToBuyPct": round((funnel_overall or {}).get("viewToBuy", 0) * 100, 1),
        "customersAtRisk": (churn or {}).get("atRiskCount", 0),
    }
    # headline figures the reply must contain (same rounding as display)
    keys = [
        _rs(k["revenue"]), str(k["orders"]), str(k["customers"]),
        _rs(int(k["aov"])), _rs(last2[1]), _rs(last2[0]),
        *[_rs(int(r["revenue"])) for _, r in top3.iterrows()],
        *[_rs(f["forecastRevenue"]) for f in fc],
    ]
    return facts, keys


PROMPT = """You write a short weekly summary for the owner of Lakeside Store, an online shop.

RULES — follow them strictly:
- Use ONLY the numbers in FACTS below. Copy each money figure EXACTLY as shown (₹ sign, commas, digits).
- Do NOT compute new numbers: no percentages, no totals, no averages of your own.
- Do NOT mention dates, and do NOT speculate about causes ("because of Diwali" etc.).
- Cover EVERY one of these 8 points, one bullet each, in this order:
  1. total revenue, total orders, customers, avg order value
  2. last full week revenue vs previous week revenue
  3. top 3 products with units and revenue
  4. biggest category mover with its change percent
  5. customer segments with sizes
  6. anomaly days flagged and customers at risk
  7. forecast for BOTH months with revenue
  8. funnel view-to-buy percent
- Max 200 words. No greeting, no sign-off.

FACTS:
{facts}
"""


def _tokens(text: str) -> list[str]:
    return re.findall(r"-?[\d,]+(?:\.\d+)?%?", text)


def _norm(tok: str) -> str:
    return tok.rstrip("%").replace(",", "")


def number_check(text: str, keys: list[str]) -> tuple[bool, list[str]]:
    """Every headline figure must appear digit-for-digit in the reply."""
    toks = [_norm(t) for t in _tokens(text)]
    toks_nodot = [t.replace(".", "") for t in toks]
    missing = [k for k in keys
               if k not in toks and k.replace(".", "") not in toks_nodot]
    return (not missing, missing)


def template_summary(facts: dict) -> str:
    top = "\n".join(f"- {p['name']}: {p['units']} units, {p['revenue']}" for p in facts["topProducts"])
    fc = "\n".join(f"- {f['month']}: {f['revenue']}" for f in facts["forecastNext2Months"])
    mover = facts["biggestCategoryMover"]
    return (
        f"Lakeside Store weekly summary (template — LLM text failed verification).\n"
        f"Revenue so far: {facts['totalRevenue']} across {facts['totalOrders']} orders "
        f"from {facts['customers']} customers (avg order {facts['avgOrderValue']}).\n"
        f"Last full week: {facts['lastFullWeekRevenue']} vs {facts['previousWeekRevenue']} the week before.\n"
        f"Top products:\n{top}\n"
        f"Biggest category mover: {mover['category']} ({mover['changePct']:+.1f}% in {mover['month']}).\n"
        f"Segments: " + ", ".join(f"{s} ({n})" for s, n in facts["segments"].items()) + ".\n"
        f"Anomaly days flagged: {facts['anomalyDays']}. "
        f"Customers at risk: {facts['customersAtRisk']}. "
        f"Funnel view-to-buy: {facts['funnelViewToBuyPct']}%.\n"
        f"Forecast:\n{fc}"
    )


def generate(prompt: str, model: str = MODEL) -> tuple[str, str]:
    """Returns (text, model_used). Falls through to cheaper models on 503s."""
    from google import genai
    from google.genai import types
    from google.genai.errors import ClientError, ServerError
    client = genai.Client(api_key=GEMINI_API_KEY)
    last_err: Exception | None = None
    for candidate in [model, *[m for m in FALLBACK_MODELS if m != model]]:
        try:
            resp = client.models.generate_content(
                model=candidate,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=400),
            )
            return ((resp.text or "").strip(), candidate)
        except ServerError as err:  # capacity / transient: try the next model
            print(f"{candidate} unavailable ({err}). Trying fallback...")
            last_err = err
        except ClientError:
            raise  # auth / not-found: retrying is pointless
    raise last_err or RuntimeError("no model available")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="regenerate even if facts unchanged")
    ap.add_argument("--dry-run", action="store_true", help="print facts + prompt, call nothing")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    try:  # Windows consoles default to cp1252, which cannot print ₹
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    if not GEMINI_API_KEY and not args.dry_run:
        raise SystemExit("GEMINI_API_KEY is not set (analytics/.env). Nothing was spent.")

    client = get_client()
    try:
        cols = get_collections(client)
        from .config import db_name
        db = client[db_name()]
        for name in ("analytics_segments", "analytics_pairs", "analytics_trends",
                     "analytics_anomalies", "analytics_funnel", "insights"):
            cols[name] = db[name]
        meta = cols["analytics_segments"].find_one({"type": "kmeans_meta"}, sort=[("generatedAt", -1)])
        run_id = (meta or {}).get("runId")
        facts, keys = build_facts(cols, run_id)
    finally:
        pass

    digest = hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()
    prompt = PROMPT.format(facts=json.dumps(facts, indent=2))
    if args.dry_run:
        print(prompt)
        print("\n[keyFigures]", keys)
        client.close()
        return

    existing = cols["insights"].find_one({"inputHash": digest})
    if existing and not args.force:
        print(f"Facts unchanged since {existing['generatedAt']} — reusing cached summary (no API call).")
        print("\n" + existing["text"])
        client.close()
        return

    print(f"Calling {args.model} ...")
    text, used_model = generate(prompt, args.model)
    ok, missing = number_check(text, keys)
    if not ok:
        print(f"Number check FAILED (missing {missing}) — falling back to template.")
        print("--- model raw text (rejected) ---")
        print(text)
        print("--- end raw text ---")
        text = template_summary(facts)
    else:
        print("Number check passed.")
    cols["insights"].insert_one({
        "type": "weekly_summary",
        "text": text,
        "facts": facts,
        "verified": bool(ok),
        "model": used_model,
        "inputHash": digest,
        "runId": run_id,
        "generatedAt": datetime.now(timezone.utc),
    })
    print("\n" + text)
    client.close()


if __name__ == "__main__":
    main()
