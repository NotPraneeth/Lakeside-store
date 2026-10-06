# Analytics (Stage 2)

Batch Python job over the store's MongoDB orders. The website never calls this;
it reads precomputed `analytics_*` / `insights` collections (dashboard in Slice C).

## Setup

```powershell
python -m venv analytics/venv
analytics/venv/Scripts/python -m pip install -r analytics/requirements.txt
```

Config comes from the environment (`MONGODB_URI`, `GEMINI_API_KEY`), honouring
`shop/.env.local`. Never commit secrets.

## Pipeline

```powershell
# (re)generate synthetic data — 650 users / ~22.6k orders / 30 months, flagged isSynthetic
analytics/venv/Scripts/python -m analytics.generate_fake_orders --months 30 --users 650 --orders 22500
# regenerate events (~360k: views/adds/searches/filters, isSynthetic, consistent
# with the orders above plus realistic noise)
analytics/venv/Scripts/python -m analytics.generate_fake_events
# run everything: descriptive + 6 ML jobs + funnel + validation scoreboard
analytics/venv/Scripts/python -m analytics.run_all
# real orders only (thin: a handful of orders, ML needs the synthetic volume)
analytics/venv/Scripts/python -m analytics.run_all --no-synthetic
# owner summary via Gemini (needs GEMINI_API_KEY in analytics/.env; cached by facts hash)
analytics/venv/Scripts/python -m analytics.insights_llm
```

| Module | Method | Writes to |
|---|---|---|
| `descriptive` | revenue series, top products/categories, AOV, repeat rate, day-of-week | stdout |
| `segmentation` | RFM + K-Means (k=3–6, silhouette + min-size guard, log-scaled spend) | `analytics_segments` |
| `pairs` | baskets → support/confidence/lift (≥0.2% support, lift ≥ 1) | `analytics_pairs` |
| `trends` | STL decomposition, period 7 (robust) + category MoM growth | `analytics_trends` |
| `forecast` | monthly seasonal Holt-Winters vs naive, rolling-origin backtest | `analytics_trends` |
| `anomalies` | trailing-14d rolling z-score + Isolation Forest | `analytics_anomalies` |
| `churn` | 2× median-gap rule → `atRisk` flags | `analytics_segments` |
| `funnel` | view→cart→buy per product/category, abandonment, search stats | `analytics_funnel` |
| `insights_llm` | Gemini weekly owner summary (facts JSON, digit-exact number check, hash cache) | `insights` |
| `validate` | scoreboard vs `planted_truth.json` | stdout |

Every result doc carries `runId` + `generatedAt`. Synthetic docs are the only
ones ever deleted (`isSynthetic: true`); real store data is never touched.

## Watch out: TTL vs synthetic history

The `events` TTL (~40 months) must stay longer than the synthetic span
(~30 months). A shorter TTL once silently ate 124k old events via Mongo's
background TTL monitor — funnel consistency dropped to 52% with no error
anywhere. If counts ever look short, check the TTL index first.

## Model notes (Oct 2026)

- `gemini-2.5-flash` is retired for new API keys (404); the job defaults to
  `gemini-flash-lite-latest` with capacity fallbacks — lite models are fine
  here because all math is precomputed; the model only verbalizes checked facts.
- Lite models tend to *omit* sections, so the prompt enforces an 8-bullet
  checklist, and the number check requires every headline figure digit-exact.
- Keys must use the SAME rounding as the displayed ₹ strings — `//100`
  (floor) vs `round()` once differed by ₹1 on forecast figures and wrongly
  failed verification. `_rs()` centralizes this.

## Honesty notes (synthetic data!)

- 30 months of history exist *because* forecasting seasonality needs ≥2 annual
  cycles — a new real store won't have this; the generator makes the pipeline
  testable, not the results transferable.
- RFM segments describe **behavior** (frequency/recency/spend), not the
  planted category personas — the cross-tab is reported, not forced.
- Forecast grain is monthly: weekly revenue is too noisy for any model to beat
  "same as last week" (we verified this). Monthly seasonal HW wins honestly.
- Anomalies are candidates to investigate; the code doesn't know causes.
