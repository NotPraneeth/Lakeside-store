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
# run everything: descriptive + 6 ML jobs + validation scoreboard
analytics/venv/Scripts/python -m analytics.run_all
# real orders only (thin: a handful of orders, ML needs the synthetic volume)
analytics/venv/Scripts/python -m analytics.run_all --no-synthetic
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
| `validate` | scoreboard vs `planted_truth.json` | stdout |

Every result doc carries `runId` + `generatedAt`. Synthetic docs are the only
ones ever deleted (`isSynthetic: true`); real store data is never touched.

## Honesty notes (synthetic data!)

- 30 months of history exist *because* forecasting seasonality needs ≥2 annual
  cycles — a new real store won't have this; the generator makes the pipeline
  testable, not the results transferable.
- RFM segments describe **behavior** (frequency/recency/spend), not the
  planted category personas — the cross-tab is reported, not forced.
- Forecast grain is monthly: weekly revenue is too noisy for any model to beat
  "same as last week" (we verified this). Monthly seasonal HW wins honestly.
- Anomalies are candidates to investigate; the code doesn't know causes.
