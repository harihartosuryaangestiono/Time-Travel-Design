"use server";

import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { getCostControlDashboard } from "./varianceActions";
import { getSCurveReport } from "./scheduleActions";
import { getBudgetVsActualComparison } from "./rapActions";

export interface ProjectMonitoringSummary {
  projectId: string;
  projectName: string;
  projectCode: string;
  contractValue: number;
  totalBudget: number;
  totalActualCost: number;
  budgetConsumptionPercent: number;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  progressVariancePercent: number;
  scheduleStatus: "AHEAD_OF_SCHEDULE" | "ON_SCHEDULE" | "DELAYED";
  materialCost: number;
  laborCost: number;
  otherCost: number;
  anomaliesCount: number;
  forecastFinalCost: number | null;
  projectedProfit: number | null;
  projectedMarginPercent: number | null;
  healthStatus: "HEALTHY" | "WATCHLIST" | "AT_RISK";
}

export async function getProjectMonitoringOverview(projectId?: string): Promise<{
  selectedProjectId?: string;
  projects: Array<{ id: string; name: string; code: string }>;
  summary: ProjectMonitoringSummary | null;
  dashboard: Awaited<ReturnType<typeof getCostControlDashboard>>;
  sCurve: Awaited<ReturnType<typeof getSCurveReport>> | null;
  budgetVsActual: Awaited<ReturnType<typeof getBudgetVsActualComparison>> | null;
}> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, code, contract_value")
    .eq("organization_id", user.organizationId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Gagal memuat proyek: ${error.message}`);

  const activeProject =
    (projects || []).find((p) => p.id === projectId) || projects?.[0] || null;

  const dashboard = await getCostControlDashboard(activeProject?.id);

  let sCurve = null;
  let budgetVsActual = null;
  let summary: ProjectMonitoringSummary | null = null;

  if (activeProject) {
    sCurve = await getSCurveReport(activeProject.id);
    budgetVsActual = await getBudgetVsActualComparison(activeProject.id);

    const plannedProg = sCurve?.currentPlannedCumulative || 0;
    const actualProg = sCurve?.currentActualCumulative || 0;
    const progVar = sCurve?.scheduleVariancePercent || 0;
    const budgetConsumption = dashboard.budgetConsumptionPercent;

    let healthStatus: ProjectMonitoringSummary["healthStatus"] = "HEALTHY";
    if (progVar < -7.0 || budgetConsumption > 100 || dashboard.investigationItemsCount > 2) {
      healthStatus = "AT_RISK";
    } else if (progVar < -3.0 || budgetConsumption > 85 || dashboard.anomaliesCount > 0) {
      healthStatus = "WATCHLIST";
    }

    summary = {
      projectId: activeProject.id,
      projectName: activeProject.name,
      projectCode: activeProject.code,
      contractValue: Number(activeProject.contract_value || dashboard.totalBudget),
      totalBudget: dashboard.totalBudget,
      totalActualCost: dashboard.totalActualCost,
      budgetConsumptionPercent: dashboard.budgetConsumptionPercent,
      plannedProgressPercent: plannedProg,
      actualProgressPercent: actualProg,
      progressVariancePercent: progVar,
      scheduleStatus: sCurve?.scheduleStatus || "ON_SCHEDULE",
      materialCost: dashboard.totalMaterialCost,
      laborCost: dashboard.totalLaborCost,
      otherCost: dashboard.totalOtherCost,
      anomaliesCount: dashboard.anomaliesCount,
      forecastFinalCost: budgetVsActual?.forecastFinalCost ?? null,
      projectedProfit: budgetVsActual?.projectedProfit ?? null,
      projectedMarginPercent: budgetVsActual?.projectedMarginPercent ?? null,
      healthStatus,
    };
  }

  return {
    selectedProjectId: activeProject?.id,
    projects: (projects || []).map((p) => ({ id: p.id, name: p.name, code: p.code })),
    summary,
    dashboard,
    sCurve,
    budgetVsActual,
  };
}
