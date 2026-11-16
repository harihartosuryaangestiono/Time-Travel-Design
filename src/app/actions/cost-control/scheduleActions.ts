"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";
import { calculateSCurve } from "@/lib/cost-control/sCurveCalculations";

const SCHEDULE_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertScheduleEditor(role: string) {
  if (!SCHEDULE_EDITOR_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengubah jadwal dan progres terverifikasi.");
  }
}

export interface ProjectScheduleItem {
  id: string;
  organization_id: string;
  project_id: string;
  rap_item_id?: string | null;
  task_name: string;
  division: string;
  budget_amount: number;
  weight_percentage: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  pic_name?: string | null;
  sort_order: number;
  current_actual_progress?: number;
}

export interface SCurvePoint {
  week: number;
  label: string;
  date: string;
  plannedProgress: number; // Progress planned this week (%)
  plannedCumulative: number; // Cumulative planned progress (%)
  actualProgress?: number; // Progress achieved this week (%)
  actualCumulative?: number; // Cumulative actual progress (%)
  variance?: number; // actualCumulative - plannedCumulative
}

export interface SCurveReport {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalDurationWeeks: number;
  totalBudget: number;
  totalWeight: number; // Should be 100%
  currentWeek: number;
  currentPlannedCumulative: number;
  currentActualCumulative: number;
  scheduleVariancePercent: number; // + ahead, - behind
  scheduleStatus: "AHEAD_OF_SCHEDULE" | "ON_SCHEDULE" | "DELAYED";
  curveData: SCurvePoint[];
  tasks: ProjectScheduleItem[];
}

// ----------------------------------------------------
// 1. JADWAL & BOBOT PEKERJAAN
// ----------------------------------------------------

export async function getProjectSchedules(projectId: string): Promise<ProjectScheduleItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const { data, error } = await supabase
    .from("project_schedules")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Gagal memuat jadwal pekerjaan: ${error.message}`);

  if (!data || data.length === 0) return [];

  // Load latest progress per schedule
  const { data: progressRecords, error: progressError } = await supabase
    .from("project_progress_records")
    .select("schedule_id, actual_progress_percent, period_week")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .not("verified_by", "is", null)
    .not("verified_at", "is", null)
    .order("period_week", { ascending: false });

  if (progressError) throw new Error(`Gagal memuat progres pekerjaan: ${progressError.message}`);

  const latestProgressMap = new Map<string, number>();
  (progressRecords || []).forEach((p) => {
    if (!latestProgressMap.has(p.schedule_id)) {
      latestProgressMap.set(p.schedule_id, Number(p.actual_progress_percent || 0));
    }
  });

  return (data || []).map((row) => ({
    ...row,
    budget_amount: Number(row.budget_amount),
    weight_percentage: Number(row.weight_percentage),
    duration_days: Number(row.duration_days),
    current_actual_progress: latestProgressMap.get(row.id) || 0,
  }));
}

export async function createProjectSchedule(input: {
  project_id: string;
  task_name: string;
  division: string;
  budget_amount: number;
  start_date: string;
  end_date: string;
  pic_name?: string;
  sort_order?: number;
}) {
  const user = await requireAuthUser();
  assertScheduleEditor(user.role);
  const supabase = await createClient();

  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error("Tanggal akhir jadwal harus setelah tanggal mulai yang valid.");
  }
  if (!Number.isFinite(input.budget_amount) || input.budget_amount < 0) {
    throw new Error("Anggaran jadwal harus berupa angka valid dan tidak negatif.");
  }
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");
  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const { data, error } = await supabase
    .from("project_schedules")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      task_name: input.task_name.trim(),
      division: input.division.trim(),
      budget_amount: input.budget_amount,
      weight_percentage: 0, // recalculated below
      start_date: input.start_date,
      end_date: input.end_date,
      duration_days: duration,
      pic_name: input.pic_name || null,
      sort_order: input.sort_order ?? 10,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambahkan jadwal pekerjaan: ${error.message}`);

  await recalculateProjectWeights(input.project_id);

  revalidatePath("/cost-control/work-weights");
  revalidatePath("/cost-control/s-curve");
  return data;
}

export async function updateProjectSchedule(
  id: string,
  projectId: string,
  input: {
    task_name?: string;
    division?: string;
    budget_amount?: number;
    start_date?: string;
    end_date?: string;
    pic_name?: string;
    sort_order?: number;
  }
) {
  const user = await requireAuthUser();
  assertScheduleEditor(user.role);
  const supabase = await createClient();

  const { data: existingSchedule, error: existingError } = await supabase
    .from("project_schedules")
    .select("id, start_date, end_date")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (existingError) throw new Error(`Gagal memvalidasi jadwal: ${existingError.message}`);
  if (!existingSchedule) throw new Error("Jadwal tidak ditemukan di proyek ini.");

  const updates: Record<string, string | number | null> = {};
  if (input.task_name !== undefined) updates.task_name = input.task_name.trim();
  if (input.division !== undefined) updates.division = input.division.trim();
  if (input.budget_amount !== undefined) {
    if (!Number.isFinite(input.budget_amount) || input.budget_amount < 0) {
      throw new Error("Anggaran jadwal harus berupa angka valid dan tidak negatif.");
    }
    updates.budget_amount = input.budget_amount;
  }
  if (input.start_date !== undefined) updates.start_date = input.start_date;
  if (input.end_date !== undefined) updates.end_date = input.end_date;
  if (input.pic_name !== undefined) updates.pic_name = input.pic_name || null;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;
  if (input.start_date !== undefined || input.end_date !== undefined) {
    const start = new Date(input.start_date ?? existingSchedule.start_date);
    const end = new Date(input.end_date ?? existingSchedule.end_date);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new Error("Tanggal akhir jadwal harus setelah tanggal mulai yang valid.");
    }
    updates.duration_days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  const { data, error } = await supabase
    .from("project_schedules")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui jadwal pekerjaan: ${error.message}`);

  if (input.budget_amount !== undefined) {
    await recalculateProjectWeights(projectId);
  }

  revalidatePath("/cost-control/work-weights");
  revalidatePath("/cost-control/s-curve");
  return data;
}

export async function deleteProjectSchedule(id: string, projectId: string) {
  const user = await requireAuthUser();
  assertScheduleEditor(user.role);
  const supabase = await createClient();

  const { data: existingSchedule, error: existingError } = await supabase
    .from("project_schedules")
    .select("id")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (existingError) throw new Error(`Gagal memvalidasi jadwal: ${existingError.message}`);
  if (!existingSchedule) throw new Error("Jadwal tidak ditemukan di proyek ini.");

  const { error } = await supabase
    .from("project_schedules")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus jadwal pekerjaan: ${error.message}`);

  await recalculateProjectWeights(projectId);

  revalidatePath("/cost-control/work-weights");
  revalidatePath("/cost-control/s-curve");
  return { success: true };
}

export async function recalculateProjectWeights(projectId: string) {
  const user = await requireAuthUser();
  assertScheduleEditor(user.role);
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");

  const { data: schedules, error: schedulesError } = await supabase
    .from("project_schedules")
    .select("id, budget_amount")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true });

  if (schedulesError) throw new Error(`Gagal memuat jadwal proyek: ${schedulesError.message}`);
  if (!schedules || schedules.length === 0) return;

  const totalBudget = schedules.reduce((acc, s) => acc + Number(s.budget_amount || 0), 0);
  if (totalBudget <= 0) throw new Error("Total anggaran jadwal harus lebih besar dari 0 untuk menghitung bobot.");

  let assignedSum = 0;
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    let weight = (Number(s.budget_amount) / totalBudget) * 100;
    // For the last item, ensure the total exactly hits 100.0000%
    if (i === schedules.length - 1) {
      weight = Math.max(0, 100.0 - assignedSum);
    } else {
      weight = Math.round(weight * 10000) / 10000;
      assignedSum += weight;
    }

    const { error } = await supabase
      .from("project_schedules")
      .update({ weight_percentage: weight })
      .eq("id", s.id);
    if (error) throw new Error(`Gagal memperbarui bobot jadwal: ${error.message}`);
  }
}

// ----------------------------------------------------
// 2. PENCATATAN PROGRES & GENERASI KURVA S
// ----------------------------------------------------

export async function recordProjectProgress(input: {
  project_id: string;
  schedule_id: string;
  period_week: number;
  planned_progress_percent?: number;
  actual_progress_percent: number;
  record_date?: string;
  verified_by?: string;
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertScheduleEditor(user.role);
  const supabase = await createClient();

  if (!Number.isInteger(input.period_week) || input.period_week < 1) {
    throw new Error("Minggu progres harus berupa bilangan bulat minimal 1.");
  }
  if (!Number.isFinite(input.actual_progress_percent) || input.actual_progress_percent < 0 || input.actual_progress_percent > 100) {
    throw new Error("Progres aktual harus berada di antara 0 dan 100 persen.");
  }
  if (
    input.planned_progress_percent !== undefined &&
    (!Number.isFinite(input.planned_progress_percent) || input.planned_progress_percent < 0 || input.planned_progress_percent > 100)
  ) {
    throw new Error("Progres rencana harus berada di antara 0 dan 100 persen.");
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from("project_schedules")
    .select("id")
    .eq("id", input.schedule_id)
    .eq("project_id", input.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (scheduleError) throw new Error(`Gagal memvalidasi jadwal: ${scheduleError.message}`);
  if (!schedule) throw new Error("Jadwal tidak ditemukan di proyek ini.");

  const { data, error } = await supabase
    .from("project_progress_records")
    .upsert(
      {
        organization_id: user.organizationId,
        project_id: input.project_id,
        schedule_id: input.schedule_id,
        period_week: input.period_week,
        planned_progress_percent: input.planned_progress_percent ?? 0,
        actual_progress_percent: input.actual_progress_percent,
        record_date: input.record_date || new Date().toISOString(),
        verified_by: user.profileId || user.id,
        verified_at: new Date().toISOString(),
        notes: input.notes || null,
        created_by: user.profileId || user.id,
      },
      { onConflict: "project_id, schedule_id, period_week" }
    )
    .select()
    .single();

  if (error) throw new Error(`Gagal mencatat progres pekerjaan: ${error.message}`);

  await logAudit(user, {
    action: "RECORD_PROJECT_PROGRESS",
    entityType: "project_progress_records",
    entityId: data.id,
    metadata: {
      schedule_id: input.schedule_id,
      week: input.period_week,
      actual_progress: input.actual_progress_percent,
    },
  });

  revalidatePath("/cost-control/s-curve");
  return data;
}

export async function getSCurveReport(projectId: string): Promise<SCurveReport> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, code, start_date, end_date")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .single();

  if (projectError) throw new Error(`Gagal memuat proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const tasks = await getProjectSchedules(projectId);
  const totalWeight = tasks.reduce((acc, t) => acc + t.weight_percentage, 0);
  const totalBudget = tasks.reduce((acc, t) => acc + t.budget_amount, 0);

  if (tasks.length === 0) {
    return {
      projectId,
      projectName: project.name,
      projectCode: project.code,
      totalDurationWeeks: 0,
      totalBudget: 0,
      totalWeight: 0,
      currentWeek: 1,
      currentPlannedCumulative: 0,
      currentActualCumulative: 0,
      scheduleVariancePercent: 0,
      scheduleStatus: "ON_SCHEDULE",
      curveData: [],
      tasks: [],
    };
  }
  if (Math.abs(totalWeight - 100) > 0.0001) {
    throw new Error(`Total bobot jadwal harus 100%; saat ini ${totalWeight.toFixed(4)}%.`);
  }

  const { data: progressRecords, error: progressError } = await supabase
    .from("project_progress_records")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .not("verified_by", "is", null)
    .not("verified_at", "is", null)
    .order("period_week", { ascending: true });

  if (progressError) throw new Error(`Gagal memuat progres pekerjaan: ${progressError.message}`);

  const calculation = calculateSCurve(
    tasks,
    (progressRecords || []).map((record) => ({
      schedule_id: record.schedule_id,
      period_week: Number(record.period_week),
      actual_progress_percent: Number(record.actual_progress_percent),
      verified_by: record.verified_by,
      verified_at: record.verified_at,
    })),
  );

  return {
    projectId,
    projectName: project.name,
    projectCode: project.code,
    totalBudget,
    totalWeight: Math.round(totalWeight * 100) / 100,
    ...calculation,
    tasks,
  };
}
