import { describe, expect, it } from "vitest";
import { calculateSCurve, type SCurveProgressInput } from "./sCurveCalculations";

describe("calculateSCurve", () => {
  it("calculates a 12-week weighted curve from verified progress and totals planned weight to 100%", () => {
    const tasks = [
      { id: "tile", weight_percentage: 40, start_date: "2026-01-05", end_date: "2026-03-30" },
      { id: "paint", weight_percentage: 60, start_date: "2026-01-05", end_date: "2026-03-30" },
    ];
    const records: SCurveProgressInput[] = Array.from({ length: 12 }, (_, index) => {
      const week = index + 1;
      return [
        {
          schedule_id: "tile",
          period_week: week,
          actual_progress_percent: (week / 12) * 100,
          verified_by: "supervisor",
          verified_at: `2026-01-${String(week + 5).padStart(2, "0")}T00:00:00Z`,
        },
        {
          schedule_id: "paint",
          period_week: week,
          actual_progress_percent: week * 5,
          verified_by: "supervisor",
          verified_at: `2026-01-${String(week + 5).padStart(2, "0")}T00:00:00Z`,
        },
      ];
    }).flat();

    records.push({
      schedule_id: "tile",
      period_week: 12,
      actual_progress_percent: 100,
    });

    const result = calculateSCurve(tasks, records, new Date("2026-03-30T00:00:00Z"));

    expect(result.totalDurationWeeks).toBe(12);
    expect(result.curveData).toHaveLength(12);
    expect(result.curveData[11].plannedCumulative).toBe(100);
    expect(result.curveData[11].actualCumulative).toBe(76);
    expect(result.currentPlannedCumulative).toBe(100);
    expect(result.currentActualCumulative).toBe(76);
    expect(result.scheduleVariancePercent).toBe(-24);
    expect(result.scheduleStatus).toBe("DELAYED");
  });
});
