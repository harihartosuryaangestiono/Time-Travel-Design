"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Search,
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Edit3,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import { ProjectModal, ProjectFormData } from "@/components/modals/ProjectModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteProject } from "@/app/actions/projectActions";

interface ProjectItem {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "PLANNING" | "COMPLETED" | "ON_HOLD" | "CANCELLED";
  contract_value: number;
  received_amount: number;
  spent_amount: number;
  client?: { id: string; name: string };
  building_function?: string | null;
  work_category?: string | null;
  deadline?: string;
}

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function formatProjectDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function ProjectsContent() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        setIsLoading(false);
        return;
      }

      const [
        { data: projectsData, error: projErr },
        { data: clientsData, error: clientsErr },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("clients")
          .select("id, name")
          .eq("organization_id", membership.organization_id),
      ]);

      if (projErr) {
        throw new Error(projErr.message);
      }
      if (clientsErr) {
        throw new Error(clientsErr.message);
      }

      const projectIds = (projectsData || []).map((project) => project.id);
      const [
        { data: allocationsData, error: allocationsErr },
        { data: revenuesData, error: revenuesErr },
      ] = projectIds.length
        ? await Promise.all([
            supabase
              .from("expense_allocations")
              .select("expense_id, project_id, amount")
              .in("project_id", projectIds),
            supabase
              .from("project_revenues")
              .select("project_id, amount")
              .eq("organization_id", membership.organization_id)
              .in("project_id", projectIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];

      if (allocationsErr) {
        throw new Error(allocationsErr.message);
      }
      if (revenuesErr) {
        throw new Error(revenuesErr.message);
      }

      const allocatedExpenseIds = Array.from(
        new Set((allocationsData || []).map((allocation) => allocation.expense_id))
      );
      const [
        { data: allocatedExpenses, error: allocatedExpensesError },
        { data: directExpenses, error: directExpensesError },
      ] = await Promise.all([
        allocatedExpenseIds.length
          ? supabase
              .from("expenses")
              .select("id, status")
              .eq("organization_id", membership.organization_id)
              .in("id", allocatedExpenseIds)
              .in("status", ["APPROVED", "POSTED"])
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase
              .from("expenses")
              .select("id, project_id, total_amount")
              .eq("organization_id", membership.organization_id)
              .in("project_id", projectIds)
              .in("status", ["APPROVED", "POSTED"])
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (allocatedExpensesError) {
        throw new Error(allocatedExpensesError.message);
      }
      if (directExpensesError) {
        throw new Error(directExpensesError.message);
      }

      const postedExpenseIds = new Set((allocatedExpenses || []).map((expense) => expense.id));
      const expenseIdsWithAllocations = new Set(allocatedExpenseIds);
      const spendByProject: Record<string, number> = {};
      const receivedByProject: Record<string, number> = {};
      (revenuesData || []).forEach((revenue) => {
        const amount = Number(revenue.amount || 0);
        if (Number.isFinite(amount)) {
          receivedByProject[revenue.project_id] =
            (receivedByProject[revenue.project_id] || 0) + amount;
        }
      });
      (allocationsData || []).forEach((a: any) => {
        if (!postedExpenseIds.has(a.expense_id)) return;
        const amt = parseFloat(a.amount || "0");
        if (a.project_id && !isNaN(amt)) {
          spendByProject[a.project_id] = (spendByProject[a.project_id] || 0) + amt;
        }
      });
      (directExpenses || []).forEach((expense) => {
        if (expenseIdsWithAllocations.has(expense.id)) return;
        const amt = Number(expense.total_amount || 0);
        if (expense.project_id && Number.isFinite(amt)) {
          spendByProject[expense.project_id] = (spendByProject[expense.project_id] || 0) + amt;
        }
      });

      const clientNames = new Map(
        (clientsData || []).map((client) => [client.id, client.name])
      );

      const mapped: ProjectItem[] = (projectsData || []).map((p: any) => {
        const cVal = parseFloat(p.contract_value || "0");
        const realSpent = spendByProject[p.id] || 0;
        const clientName = p.client_id ? clientNames.get(p.client_id) : undefined;

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status || "ACTIVE",
          contract_value: isNaN(cVal) ? 0 : cVal,
          received_amount: receivedByProject[p.id] || 0,
          spent_amount: realSpent,
          client: clientName && p.client_id ? { id: p.client_id, name: clientName } : undefined,
          building_function: p.building_function || null,
          work_category:
            p.work_category ||
            (p.type === "INTERIOR_DESIGN"
              ? "Interior & Furniture"
              : p.type === "RENOVATION"
              ? "Renovation"
              : p.type === "CONSTRUCTION"
              ? "Build From Scratch"
              : null),
          deadline: p.end_date ? String(p.end_date).slice(0, 10) : "",
        };
      });

      setProjects(mapped);
    } catch (e: any) {
      console.error("Error fetching projects:", e);
      setError(e?.message || "Gagal memuat daftar proyek.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSaveProject = async () => {
    await fetchProjects();
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      await deleteProject(projectToDelete.id);
      await fetchProjects();
      setShowDelete(false);
      setProjectToDelete(null);
    } catch (e: any) {
      console.error("Delete project error:", e);
      alert(e?.message || "Gagal menghapus proyek.");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalContract = projects.reduce((s, p) => s + (p.contract_value || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.spent_amount || 0), 0);
  const activeProjectsCount = projects.filter((p) => p.status === "ACTIVE").length;
  const completedProjectsCount = projects.filter((p) => p.status === "COMPLETED").length;

  const averageMargin =
    totalContract > 0
      ? Math.round(((totalContract - totalSpent) / totalContract) * 100)
      : 0;

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.client?.name && p.client.name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nilai Kontrak Proyek"
          value={isLoading ? "..." : formatCurrency(totalContract)}
          subtitle={`${projects.length} kontrak proyek terdaftar`}
          icon={FolderKanban}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Proyek Berjalan (Aktif)"
          value={isLoading ? "..." : `${activeProjectsCount} Proyek`}
          subtitle="Sedang dalam fase konstruksi / desain"
          icon={Briefcase}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Proyek Selesai"
          value={isLoading ? "..." : `${completedProjectsCount} Proyek`}
          subtitle="Pekerjaan selesai 100%"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Rata-rata Margin Proyek"
          value={isLoading ? "..." : projects.length > 0 ? `${averageMargin}%` : "-"}
          subtitle={
            totalContract > 0
              ? `Biaya: ${formatCurrency(totalSpent)}`
              : "Belum ada alokasi biaya proyek"
          }
          icon={DollarSign}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchProjects}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Filter & Search Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama proyek, kode proyek, atau klien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "Semua" },
              { id: "ACTIVE", label: "Aktif" },
              { id: "PLANNING", label: "Perencanaan" },
              { id: "COMPLETED", label: "Selesai" },
              { id: "ON_HOLD", label: "Ditunda" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 transition-all text-xs",
                  statusFilter === tab.id
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedProject(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Proyek Baru</span>
          </button>
        </div>
      </div>

      {/* ── Skeleton Loading ── */}
      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-zinc-100 border border-zinc-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && projects.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900">Belum Ada Proyek</h4>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Daftarkan proyek baru untuk mulai memantau nilai kontrak, alokasi biaya HPP, dan margin laba kotor.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedProject(null);
              setShowModal(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Proyek Pertama</span>
          </button>
        </div>
      )}

      {/* ── Projects Card Grid ── */}
      {!isLoading && projects.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const val = Number(project.contract_value) || 0;
            const spent = Number(project.spent_amount) || 0;
            const percent = val > 0 ? Math.min(100, Math.round((spent / val) * 100)) : 0;

            return (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200"
              >
                <div>
                  {/* Header: Code & Status */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-zinc-400">
                      {project.code}
                    </span>
                    <Badge
                      variant={
                        project.status === "ACTIVE"
                          ? "success"
                          : project.status === "COMPLETED"
                          ? "neutral"
                          : project.status === "PLANNING"
                          ? "warning"
                          : "neutral"
                      }
                      size="sm"
                      dot
                    >
                      {project.status === "ACTIVE"
                        ? "Aktif"
                        : project.status === "COMPLETED"
                        ? "Selesai"
                        : project.status === "PLANNING"
                        ? "Rencana"
                        : "Ditunda"}
                    </Badge>
                  </div>

                  {/* Project Name */}
                  <h4 className="mt-3 text-base font-bold text-zinc-950 group-hover:text-zinc-700 transition-colors">
                    {project.name}
                  </h4>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700">
                      Fungsi: {project.building_function || "Belum diatur"}
                    </span>
                    <span className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
                      Pekerjaan: {project.work_category || "Belum diatur"}
                    </span>
                  </div>

                  {/* Client & Category */}
                  <div className="mt-2 space-y-1 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">
                        {project.client?.name || "Klien Langsung"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>
                        {project.deadline ? `Target: ${formatProjectDate(project.deadline)}` : "Target belum diatur"}
                      </span>
                    </div>
                  </div>

                  {/* Financial Stats */}
                  <div className="mt-5 rounded-2xl bg-zinc-50 p-4 border border-zinc-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Nilai Kontrak</span>
                      <span className="font-mono font-bold text-zinc-950">
                        {formatCurrency(val)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Dibayar Klien</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatCurrency(project.received_amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Sisa Pembayaran</span>
                      <span className="font-mono font-bold text-amber-700">
                        {formatCurrency(Math.max(0, val - project.received_amount))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Biaya Terserap</span>
                      <span className="font-mono font-bold text-rose-600">
                        {formatCurrency(spent)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Realisasi Anggaran</span>
                        <span className="font-mono font-bold">{percent}%</span>
                      </div>
                      <ProgressBar
                        value={percent}
                        variant={percent > 90 ? "rose" : percent > 75 ? "amber" : "emerald"}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-semibold text-zinc-900 hover:underline inline-flex items-center gap-1"
                  >
                    Buku Proyek
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProject({
                          id: project.id,
                          code: project.code,
                          name: project.name,
                          client_id: project.client?.id || "",
                          client_name: project.client?.name,
                          building_function: project.building_function || "",
                          work_category: project.work_category || "",
                          contract_value: project.contract_value,
                          status: project.status as any,
                          deadline: project.deadline || "",
                        });
                        setShowModal(true);
                      }}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                      title="Edit Proyek"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectToDelete(project);
                        setShowDelete(true);
                      }}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Hapus Proyek"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Project Create / Edit Modal ── */}
      <ProjectModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedProject(null);
        }}
        onSuccess={handleSaveProject}
        projectToEdit={selectedProject}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleDeleteProject}
        title="Hapus Master Proyek"
        description="Apakah Anda yakin ingin menghapus data proyek ini secara permanen?"
        itemName={projectToDelete ? `${projectToDelete.code} • ${projectToDelete.name}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
