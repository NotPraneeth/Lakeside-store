"""Forecasting: seasonal Holt-Winters vs naive, backtested -> analytics_trends.

Grain is MONTHLY (next 2 months ≈ 8 weeks, per the plan): weekly revenue is
too noisy for any model to beat "same as last week", while monthly
aggregation exposes the annual festive cycle. Rolling-origin backtest
(h=2 months) decides between seasonal Holt-Winters (period 12, needs >= 24
months of history), damped-trend Holt-Winters, and the rolling naive
baseline. The winner refits on the full series and forecasts 2 months.
"""

from datetime import datetime, timezone
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

warnings.filterwarnings("ignore", category=UserWarning)
try:
    from statsmodels.tools.sm_exceptions import ConvergenceWarning
    warnings.filterwarnings("ignore", category=ConvergenceWarning)
except ImportError:
    pass

HORIZON = 2  # months
ORIGIN_STEP = 3
MIN_TRAIN = 12
FORECAST_MONTHS = 2


def _monthly(items: pd.DataFrame) -> pd.Series:
    df = items.copy()
    df["month"] = df["createdAt"].dt.tz_localize(None).dt.to_period("M")
    g = df.groupby("month")["lineTotal"].sum().sort_index()
    full = pd.Series(
        0, index=pd.period_range(g.index.min(), g.index.max(), freq="M"))
    g = full.add(g, fill_value=0).astype(int)
    # drop a trailing partial month
    if len(g) > MIN_TRAIN + HORIZON and g.iloc[-1] < 0.4 * g.median():
        g = g.iloc[:-1]
    g.index = g.index.to_timestamp(how="E")
    return g.astype(float)


def _mape(actual: np.ndarray, pred: np.ndarray) -> float:
    actual = np.asarray(actual, dtype=float)
    mask = actual != 0
    return round(float(np.mean(np.abs((actual[mask] - pred[mask]) / actual[mask]))), 4)


def _mae(actual: np.ndarray, pred: np.ndarray) -> float:
    return round(float(np.mean(np.abs(np.asarray(actual) - np.asarray(pred)))), 2)


def _fit_trend(y: pd.Series):
    return ExponentialSmoothing(y, trend="add", damped_trend=True,
                                use_boxcox=True).fit(optimized=True)


def _fit_seasonal(y: pd.Series):
    return ExponentialSmoothing(y, trend="add", damped_trend=True, seasonal="add",
                                seasonal_periods=12, use_boxcox=True).fit(optimized=True)


def run(items: pd.DataFrame, users: pd.DataFrame, cols, run_id: str) -> dict:
    y = _monthly(items)
    use_seasonal = len(y) >= 24
    origins = list(range(MIN_TRAIN, len(y) - HORIZON + 1, ORIGIN_STEP))

    acc: dict[str, dict[str, list]] = {
        "trend_hw": {"mae": [], "mape": []},
        "naive": {"mae": [], "mape": []},
    }
    if use_seasonal:
        acc["seasonal_hw"] = {"mae": [], "mape": []}

    for o in origins:
        train, test = y.iloc[:o], y.iloc[o:o + HORIZON]
        preds: dict[str, np.ndarray] = {
            "trend_hw": _fit_trend(train).forecast(len(test)).to_numpy(),
            "naive": np.concatenate([[train.iloc[-1]], test.to_numpy()[:-1]]),
        }
        if use_seasonal and len(train) >= 24:
            try:
                preds["seasonal_hw"] = _fit_seasonal(train).forecast(len(test)).to_numpy()
            except Exception:
                pass
        for m, p in preds.items():
            if m in acc:
                acc[m]["mae"].append(_mae(test, p))
                acc[m]["mape"].append(_mape(test, p))

    metrics = {
        m: {"mae": round(float(np.mean(v["mae"])), 2),
            "mape": round(float(np.mean(v["mape"])), 4)}
        for m, v in acc.items() if v["mae"]
    }
    winner = min([m for m in metrics if m != "naive"], key=lambda m: metrics[m]["mae"])
    beats = metrics[winner]["mae"] < metrics["naive"]["mae"]

    if winner == "seasonal_hw":
        try:
            future = _fit_seasonal(y).forecast(FORECAST_MONTHS).to_numpy()
        except Exception:
            winner = "trend_hw"
            future = _fit_trend(y).forecast(FORECAST_MONTHS).to_numpy()
    else:
        future = _fit_trend(y).forecast(FORECAST_MONTHS).to_numpy()
    future_idx = pd.date_range(y.index[-1] + pd.offsets.MonthEnd(1),
                               periods=FORECAST_MONTHS, freq="ME")

    now = datetime.now(timezone.utc)
    coll = cols["analytics_trends"]
    coll.delete_many({"runId": run_id, "type": {"$in": ["forecast_monthly", "forecast_backtest"]}})
    coll.insert_many(
        [
            {
                "type": "forecast_monthly",
                "month": ts.date().isoformat()[:7],
                "forecastRevenue": int(max(0, round(float(v)))),
                "runId": run_id,
                "generatedAt": now,
            }
            for ts, v in zip(future_idx, future)
        ]
    )
    coll.insert_one(
        {
            "type": "forecast_backtest",
            "origins": len(origins),
            "horizonMonths": HORIZON,
            "metrics": metrics,
            "modelUsed": winner,
            "modelBeatsNaive": bool(beats),
            "runId": run_id,
            "generatedAt": now,
        }
    )
    summary = {"metrics": metrics, "model": winner, "beatsNaive": bool(beats),
               "next2mo": [int(v) for v in future]}
    parts = " | ".join(f"{m} MAE={metrics[m]['mae']}" for m in metrics if m != "origins")
    print(f"[forecast] {len(origins)} origins x {HORIZON}mo (monthly): winner={winner} | "
          f"{parts} | beatsNaive={beats}")
    return summary
