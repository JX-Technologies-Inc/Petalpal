"""Shape the aggregate ops-metrics CSVs into Power BI tables (docs/analytics/POWER_BI.md).

Input:  the four CSVs from scripts/export-ops-metrics.mjs (UTC calendar days, aggregates only).
Output: Calendar, DailySummary, AiCostByModel, AiCalls and AiJobs CSVs for Power BI.

Usage:
  python3 scripts/ops-metrics/prepare_powerbi.py --in output/ops-metrics --out output/powerbi
  python3 scripts/ops-metrics/prepare_powerbi.py --demo --out output/powerbi-demo   # synthetic practice data
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

RAW = {
    "activity": "daily_activity.csv",
    "gateway": "ai_gateway_daily.csv",
    "calls": "ai_calls_daily.csv",
    "jobs": "ai_jobs_daily.csv",
}


def load(folder):
    return {key: pd.read_csv(Path(folder) / name, parse_dates=["date"]) for key, name in RAW.items()}


def calendar(start, end):
    days = pd.DataFrame({"date": pd.date_range(start, end, freq="D")})
    days["year"] = days["date"].dt.year
    days["month"] = days["date"].dt.month
    days["monthName"] = days["date"].dt.strftime("%b %Y")
    days["isoWeek"] = days["date"].dt.isocalendar().week.astype(int)
    days["weekday"] = days["date"].dt.day_name()
    return days


def daily_summary(raw, days):
    per_day = lambda frame, column: frame.groupby("date")[column].sum()
    summary = days[["date"]].set_index("date")
    activity = raw["activity"].set_index("date")
    for column in ["newUsers", "events", "activeUsers", "flowers"]:
        summary[column] = activity[column]
    summary["claudeCalls"] = per_day(raw["gateway"], "calls")
    summary["aiCostUsd"] = per_day(raw["gateway"], "estCostUsd")
    summary["otherAiCalls"] = per_day(raw["calls"], "calls")
    jobs = raw["jobs"]
    summary["jobsSucceeded"] = per_day(jobs[jobs["status"] == "SUCCEEDED"], "jobs")
    summary["jobsFailed"] = per_day(jobs[jobs["status"] == "FAILED"], "jobs")
    summary = summary.fillna(0)
    counts = ["newUsers", "events", "activeUsers", "flowers", "claudeCalls", "otherAiCalls", "jobsSucceeded", "jobsFailed"]
    summary[counts] = summary[counts].astype(int)
    finished = summary["jobsSucceeded"] + summary["jobsFailed"]
    summary["jobSuccessRate"] = (summary["jobsSucceeded"] / finished.replace(0, np.nan)).round(4)
    summary["costPerActiveUser"] = (summary["aiCostUsd"] / summary["activeUsers"].replace(0, np.nan)).round(6)
    summary["events7dAvg"] = summary["events"].rolling(7, min_periods=1).mean().round(2)
    summary["aiCost7dAvg"] = summary["aiCostUsd"].rolling(7, min_periods=1).mean().round(6)
    return summary.reset_index()


def prepare(raw):
    dates = pd.concat([frame["date"] for frame in raw.values() if not frame.empty])
    if dates.empty:
        raise SystemExit("No rows to prepare.")
    days = calendar(dates.min(), dates.max())
    return {
        "Calendar.csv": days,
        "DailySummary.csv": daily_summary(raw, days),
        "AiCostByModel.csv": raw["gateway"],
        "AiCalls.csv": raw["calls"],
        "AiJobs.csv": raw["jobs"],
    }


def demo(days=60, seed=7):
    """Synthetic practice data with the export's columns. Never use it for real figures."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(end=pd.Timestamp("2026-10-22"), periods=days, freq="D")
    active = np.clip(np.round(np.linspace(3, 18, days) + rng.normal(0, 2, days)), 1, None).astype(int)
    events = (active * rng.uniform(1.0, 2.2, days)).round().astype(int)
    activity = pd.DataFrame({"date": dates, "newUsers": rng.poisson(0.6, days), "events": events,
                             "activeUsers": active, "flowers": np.minimum(events, active * 2)})
    gateway_rows, call_rows, job_rows = [], [], []
    for date, n in zip(dates, events):
        gateway_rows.append({"date": date, "action": "EVENT_EMOTION", "provider": "ANTHROPIC", "model": "claude-haiku-5-5",
                             "calls": n, "inputTokens": n * 900, "outputTokens": n * 120,
                             "estCostUsd": round((n * 900 * 100 + n * 120 * 500) / 1e9, 6)})
        if date.weekday() == 0:
            weekly = int(active[dates.get_loc(date)])
            gateway_rows.append({"date": date, "action": "WEEKLY_REPORT", "provider": "ANTHROPIC", "model": "claude-sonnet-5-5",
                                 "calls": weekly, "inputTokens": weekly * 6000, "outputTokens": weekly * 900,
                                 "estCostUsd": round((weekly * 6000 * 2000 + weekly * 900 * 10000) / 1e9, 6)})
        call_rows.append({"date": date, "task": "EMBEDDING_GENERATION", "provider": "CLOUDFLARE", "calls": n,
                          "failures": int(rng.binomial(n, 0.02)), "avgLatencyMs": int(rng.normal(420, 60)),
                          "inputTokens": n * 300, "outputTokens": 0})
        failed = int(rng.binomial(n, 0.03))
        job_rows += [{"date": date, "jobType": "EMBEDDING_GENERATION", "status": "SUCCEEDED", "jobs": n - failed, "avgAttempts": 1.05},
                     {"date": date, "jobType": "EMBEDDING_GENERATION", "status": "FAILED", "jobs": failed, "avgAttempts": 3.0}]
    return {"activity": activity, "gateway": pd.DataFrame(gateway_rows), "calls": pd.DataFrame(call_rows), "jobs": pd.DataFrame(job_rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="source", default="output/ops-metrics")
    parser.add_argument("--out", default="output/powerbi")
    parser.add_argument("--demo", action="store_true", help="use synthetic practice data instead of --in")
    args = parser.parse_args()
    tables = prepare(demo() if args.demo else load(args.source))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, frame in tables.items():
        frame.to_csv(out / name, index=False, date_format="%Y-%m-%d", float_format="%.6f")
        print(f"{name}: {len(frame)} rows")
    print(f"Wrote Power BI tables to {out}" + (" (SYNTHETIC demo data)" if args.demo else ""))


if __name__ == "__main__":
    main()
