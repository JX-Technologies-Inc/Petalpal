"""Run: python3 -m unittest scripts/ops-metrics/test_prepare_powerbi.py (needs requirements.txt)."""
import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from prepare_powerbi import demo, prepare  # noqa: E402

D = pd.Timestamp


def raw_fixture():
    return {
        "activity": pd.DataFrame({"date": [D("2026-10-01"), D("2026-10-03")], "newUsers": [1, 0],
                                  "events": [4, 2], "activeUsers": [2, 0], "flowers": [3, 1]}),
        "gateway": pd.DataFrame({"date": [D("2026-10-01"), D("2026-10-01")], "action": ["EVENT_EMOTION", "WEEKLY_REPORT"],
                                 "provider": ["ANTHROPIC"] * 2, "model": ["claude-haiku-5-5", "claude-sonnet-5-5"],
                                 "calls": [4, 1], "inputTokens": [4000, 6000], "outputTokens": [400, 900], "estCostUsd": [0.0006, 0.021]}),
        "calls": pd.DataFrame({"date": [D("2026-10-03")], "task": ["EMBEDDING"], "provider": ["CLOUDFLARE"], "calls": [2],
                               "failures": [0], "avgLatencyMs": [400], "inputTokens": [600], "outputTokens": [0]}),
        "jobs": pd.DataFrame({"date": [D("2026-10-01")] * 2, "jobType": ["EMBEDDING_GENERATION"] * 2,
                              "status": ["SUCCEEDED", "FAILED"], "jobs": [3, 1], "avgAttempts": [1.0, 3.0]}),
    }


class PreparePowerBiTest(unittest.TestCase):
    def test_daily_summary_fills_gaps_and_derives_rates(self):
        summary = prepare(raw_fixture())["DailySummary.csv"].set_index("date")
        self.assertEqual(list(summary.index), [D("2026-10-01"), D("2026-10-02"), D("2026-10-03")])
        day1, gap = summary.loc[D("2026-10-01")], summary.loc[D("2026-10-02")]
        self.assertAlmostEqual(day1["aiCostUsd"], 0.0216)
        self.assertEqual(day1["claudeCalls"], 5)
        self.assertEqual(day1["jobSuccessRate"], 0.75)
        self.assertAlmostEqual(day1["costPerActiveUser"], 0.0108)
        self.assertEqual((gap["events"], gap["activeUsers"]), (0, 0))
        self.assertTrue(pd.isna(gap["jobSuccessRate"]))       # no finished jobs: blank, not 0%
        self.assertTrue(pd.isna(summary.loc[D("2026-10-03"), "costPerActiveUser"]))
        self.assertEqual(summary.loc[D("2026-10-03"), "events7dAvg"], 2.0)  # (4 + 0 + 2) / 3

    def test_calendar_covers_every_day_with_labels(self):
        days = prepare(raw_fixture())["Calendar.csv"]
        self.assertEqual(len(days), 3)
        self.assertEqual(days.iloc[0]["weekday"], "Thursday")
        self.assertEqual(days.iloc[0]["monthName"], "Oct 2026")

    def test_demo_data_has_the_export_columns(self):
        tables = prepare(demo())
        self.assertEqual(len(tables["DailySummary.csv"]), 60)
        self.assertTrue((tables["DailySummary.csv"]["aiCostUsd"] > 0).all())


if __name__ == "__main__":
    unittest.main()
