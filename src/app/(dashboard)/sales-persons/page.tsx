"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  Loader2,
  Pencil,
  Plus,
  Save,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { getProjects } from "@/app/actions/projectActions";
import {
  getSalesPersonOverview,
  saveSalesPerson,
  type SalesPersonSummary,
} from "@/app/actions/salesActions";
import { StatCard } from "@/components/ui/StatCard";
import { calculateSalesCommission } from "@/lib/accounting/salesCommission";

interface ProjectOption {
  id: string;
  code: string;
  name: string;
  contract_value: number | string | null;
}

interface AssignmentDraft {
  project_id: string;
  commission_rate: string;
}

interface SalesPersonDraft {
  id?: string;
  name: string;
  phone: string;
  email: string;
  assignments: AssignmentDraft[];
}

const emptyDraft: SalesPersonDraft = {
  name: "",
  phone: "",
  email: "",
  assignments: [],
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SalesPersonsPage() {
  const [people, setPeople] = useState<SalesPersonSummary[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<SalesPersonDraft>(emptyDraft);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [overview, projectRows] = await Promise.all([
        getSalesPersonOverview(),
        getProjects(),
      ]);
      setPeople(overview.people);
      setCanManage(overview.canManage);
      setProjects(projectRows.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        contract_value: project.contract_value,
      })));
    } catch (loadError) {
      console.error("Gagal memuat data Sales Person:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data Sales Person.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (isLoading || !window.location.hash) return;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, people]);

  const startCreate = () => {
    setDraft(emptyDraft);
    setError(null);
    setIsModalOpen(true);
  };

  const startEdit = (person: SalesPersonSummary) => {
    setDraft({
      id: person.id,
      name: person.name,
      phone: person.phone || "",
      email: person.email || "",
      assignments: person.assignments.map((assignment) => ({
        project_id: assignment.projectId,
        commission_rate: String(assignment.commissionRate),
      })),
    });
    setError(null);
    setIsModalOpen(true);
  };

  const addAssignment = () => {
    setDraft((current) => ({
      ...current,
      assignments: [...current.assignments, { project_id: "", commission_rate: "" }],
    }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const assignments = draft.assignments
      .filter((assignment) => assignment.project_id)
      .map((assignment) => ({
        project_id: assignment.project_id,
        commission_rate: Number(assignment.commission_rate),
      }));
    try {
      setIsSaving(true);
      setError(null);
      await saveSalesPerson({
        id: draft.id,
        name: draft.name,
        phone: draft.phone || null,
        email: draft.email || null,
        assignments,
      });
      setIsModalOpen(false);
      await loadData();
    } catch (saveError) {
      console.error("Gagal menyimpan Sales Person:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan Sales Person.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalCommission = people.reduce((sum, person) => sum + person.totalCommission, 0);
  const totalPaid = people.reduce((sum, person) => sum + person.totalPaid, 0);
  const totalRemaining = people.reduce((sum, person) => sum + person.remainingAmount, 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Sales Person</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Kelola kontak, proyek, komisi, pembayaran, dan sisa komisi sales.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            Tambah Sales Person
          </button>
        )}
      </div>

      {error && !isModalOpen && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Sales Person"
          value={isLoading ? "..." : `${people.length} orang`}
          subtitle="Sales terdaftar"
          icon={UserRound}
          iconBgColor="bg-blue-500/10"
        />
        <StatCard
          title="Total Komisi"
          value={isLoading ? "..." : formatCurrency(totalCommission)}
          subtitle="Berdasarkan nilai kontrak proyek"
          icon={BriefcaseBusiness}
          iconBgColor="bg-violet-500/10"
        />
        <StatCard
          title="Sudah Dibayar"
          value={isLoading ? "..." : formatCurrency(totalPaid)}
          subtitle="Pembayaran kategori Marketing & Sales"
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
        />
        <StatCard
          title="Sisa Komisi"
          value={isLoading ? "..." : formatCurrency(totalRemaining)}
          subtitle="Komisi dikurangi pembayaran"
          icon={Wallet}
          iconBgColor="bg-amber-500/10"
        />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat data Sales Person...
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <UserRound className="mx-auto h-8 w-8 text-zinc-400" />
          <h2 className="mt-3 font-semibold text-zinc-900">Belum ada Sales Person</h2>
          <p className="mt-1 text-sm text-zinc-500">Tambahkan sales untuk mulai mengatur komisi proyek.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {people.map((person) => (
            <section id={person.id} key={person.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-950">{person.name}</h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {person.phone || "No. HP belum diisi"}
                      {person.email ? ` · ${person.email}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Komisi / Dibayar / Sisa</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-900">
                      {formatCurrency(person.totalCommission)} / {formatCurrency(person.totalPaid)} / {formatCurrency(person.remainingAmount)}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => startEdit(person)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {person.assignments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-2.5">Proyek</th>
                        <th className="px-4 py-2.5 text-right">Nilai Kontrak</th>
                        <th className="px-4 py-2.5 text-right">Komisi</th>
                        <th className="px-4 py-2.5 text-right">Total Komisi</th>
                        <th className="px-4 py-2.5 text-right">Dibayar</th>
                        <th className="px-4 py-2.5 text-right">Sisa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {person.assignments.map((assignment) => (
                        <tr key={assignment.projectId}>
                          <td className="px-4 py-3 font-semibold text-zinc-800">
                            <span className="font-mono text-zinc-500">{assignment.projectCode}</span> {assignment.projectName}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-600">{formatCurrency(assignment.contractValue)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-600">{assignment.commissionRate}%</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">{formatCurrency(assignment.commissionAmount)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">{formatCurrency(assignment.paidAmount)}</td>
                          <td className={`px-4 py-3 text-right font-semibold tabular-nums ${assignment.remainingAmount < 0 ? "text-rose-700" : "text-amber-700"}`}>
                            {formatCurrency(assignment.remainingAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-4 text-xs text-zinc-500">Belum ada proyek dan komisi yang ditugaskan.</p>
              )}
            </section>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">
                  {draft.id ? "Edit Sales Person" : "Tambah Sales Person"}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">Isi kontak dan proyek dengan persentase komisi.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                aria-label="Tutup form"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-zinc-700">
                Nama Sales Person *
                <input
                  required
                  maxLength={150}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  placeholder="Nama lengkap"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700">
                No. HP
                <input
                  type="tel"
                  maxLength={40}
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  placeholder="08xxxxxxxxxx"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700 sm:col-span-2">
                Email (opsional)
                <input
                  type="email"
                  maxLength={254}
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  placeholder="sales@email.com"
                />
              </label>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Proyek &amp; Persentase Komisi</h3>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Komisi dihitung otomatis dari nilai kontrak proyek.</p>
                </div>
                <button
                  type="button"
                  onClick={addAssignment}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah proyek
                </button>
              </div>

              {draft.assignments.length === 0 ? (
                <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">Belum ada proyek ditambahkan.</p>
              ) : (
                <div className="space-y-2">
                  {draft.assignments.map((assignment, index) => {
                    const selectedProject = projects.find((project) => project.id === assignment.project_id);
                    const commission = selectedProject
                      ? calculateSalesCommission(
                          Number(selectedProject.contract_value || 0),
                          Number(assignment.commission_rate || 0)
                        )
                      : 0;
                    return (
                      <div key={index} className="grid gap-2 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                        <label className="text-[11px] font-semibold text-zinc-600">
                          Proyek
                          <select
                            required
                            value={assignment.project_id}
                            onChange={(event) => setDraft((current) => ({
                              ...current,
                              assignments: current.assignments.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, project_id: event.target.value } : item
                              ),
                            }))}
                            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs"
                          >
                            <option value="">Pilih proyek</option>
                            {projects.map((project) => (
                              <option
                                key={project.id}
                                value={project.id}
                                disabled={draft.assignments.some((item, itemIndex) =>
                                  itemIndex !== index && item.project_id === project.id
                                )}
                              >
                                {project.code} — {project.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] font-semibold text-zinc-600">
                          Komisi (%)
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.0001"
                            required
                            value={assignment.commission_rate}
                            onChange={(event) => setDraft((current) => ({
                              ...current,
                              assignments: current.assignments.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, commission_rate: event.target.value } : item
                              ),
                            }))}
                            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs"
                          />
                        </label>
                        <p className="text-right text-[11px] text-zinc-500 sm:pb-2">
                          {formatCurrency(commission)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}