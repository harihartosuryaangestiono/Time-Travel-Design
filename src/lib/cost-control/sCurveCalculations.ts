export interface SCurveTaskInput {
  id: string;
  weight_percentage: number;
  start_date: string;
  end_date: string;
}

export interface SCurveProgressInput {
  schedule_id: string;
  period_week: number;
  actual_progress_percent: number;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface SCurveCalculation {
  totalDurationWeeks: number;
  currentWeek: number;
  currentPlannedCumulative: number;
  currentActualCumulative: number;
  scheduleVariancePercent: number;
  scheduleStatus: "AHEAD_OF_SCHEDULE" | "ON_SCHEDULE" | "DELAYED";
  curveData: Array<{
    week: number;
    label: string;
    date: string;
    plannedProgress: number;
    plannedCumulative: number;
    actualProgress?: number;
    actualCumulative?: number;
    variance?: number;
  }>;
}

export function calculateSCurve(
  tasks: SCurveTaskInput[],
  records: SCurveProgressInput[],
  now = new Date(),
): SCurveCalculation {
  const startDates = tasks.map((task) => new Date(task.start_date).getTime());
  const endDates = tasks.map((task) => new Date(task.end_date).getTime());
  const minStart = new Date(Math.min(...startDates));
  const maxEnd = new Date(Math.max(...endDates));
  const totalDays = Math.max(7, Math.ceil((maxEnd.getTime() - minStart.getTime()) / 86_400_000));
  const totalWeeks = Math.max(4, Math.ceil(totalDays / 7));
  const weekMs = 7 * 86_400_000;
  const currentWeek = Math.max(1, Math.min(
    totalWeeks,
    Math.ceil((now.getTime() - minStart.getTime()) / weekMs),
  ));
  const progressByTask = new Map<string, Array<{ week: number; progress: number }>>();

  records
    .filter((record) => record.verified_by && record.verified_at)
    .forEach((record) => {
      const progress = progressByTask.get(record.schedule_id) || [];
      progress.push({
        week: Number(record.period_week),
        progress: Number(record.actual_progress_percent),
      });
      progressByTask.set(record.schedule_id, progress);
    });

  const curveData: SCurveCalculation["curveData"] = [];
  let plannedCumulative = 0;
  let actualCumulative = 0;

  for (let week = 1; week <= totalWeeks; week += 1) {
    const weekStart = new Date(minStart.getTime() + (week - 1) * weekMs);
    let plannedProgress = 0;

    tasks.forEach((task) => {
      const taskStart = new Date(task.start_date);
      const taskEnd = new Date(task.end_date);
      const taskStartWeek = Math.max(0, Math.floor((taskStart.getTime() - minStart.getTime()) / weekMs));
      const taskEndWeek = Math.max(taskStartWeek + 1, Math.ceil((taskEnd.getTime() - minStart.getTime()) / weekMs));
      const durationWeeks = taskEndWeek - taskStartWeek;

      if (week - 1 >= taskStartWeek && week - 1 < taskEndWeek) {
        plannedProgress += task.weight_percentage / durationWeeks;
      }
    });
    if (week === totalWeeks) {
      plannedProgress = Math.max(0, 100 - plannedCumulative);
    }
    plannedCumulative = Math.min(100, Math.round((plannedCumulative + plannedProgress) * 100) / 100);

    const previousActual = actualCumulative;
    let weightedActual = 0;
    tasks.forEach((task) => {
      const latestRecord = (progressByTask.get(task.id) || [])
        .reduce<{ week: number; progress: number } | null>(
          (latest, record) => record.week <= week && (!latest || record.week > latest.week) ? record : latest,
          null,
        );
      if (latestRecord) {
        weightedActual += (latestRecord.progress / 100) * task.weight_percentage;
      }
    });

    actualCumulative = Math.min(100, Math.round(weightedActual * 100) / 100);
    const actualProgress = week <= currentWeek
      ? Math.round((actualCumulative - previousActual) * 100) / 100
      : undefined;
    const variance = Math.round((actualCumulative - plannedCumulative) * 100) / 100;

    curveData.push({
      week,
      label: `Mg ${week}`,
      date: weekStart.toISOString().slice(0, 10),
      plannedProgress: Math.round(plannedProgress * 100) / 100,
      plannedCumulative,
      actualProgress,
      actualCumulative: week <= currentWeek ? actualCumulative : undefined,
      variance: week <= currentWeek ? variance : undefined,
    });
  }

  const currentPlannedCumulative = curveData[currentWeek - 1]?.plannedCumulative || 0;
  const currentActualCumulative = curveData[currentWeek - 1]?.actualCumulative || 0;
  const scheduleVariancePercent = Math.round((currentActualCumulative - currentPlannedCumulative) * 100) / 100;
  const scheduleStatus = scheduleVariancePercent < -3
    ? "DELAYED"
    : scheduleVariancePercent > 3
      ? "AHEAD_OF_SCHEDULE"
      : "ON_SCHEDULE";

  return {
    totalDurationWeeks: totalWeeks,
    currentWeek,
    currentPlannedCumulative,
    currentActualCumulative,
    scheduleVariancePercent,
    scheduleStatus,
    curveData,
  };
}
