"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  TrendingUp,
  FileText,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Project {
  id: string;
  code: string;
  name: string;
  type: string | null;
  status: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_value: string | null;
  description: string | null;
  client?: {
    name: string;
  };
}

interface ProjectTransaction {
  id: string;
  amount: number;
  description: string | null;
  expense?: {
    id: string;
    number: string;
    date: string;
    description: string;
    merchant: string | null;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PLANNING: { label: "Perencanaan", color: "bg-zinc-100 text-zinc-700 border border-zinc-200" },
  ACTIVE: { label: "Aktif", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  ON_HOLD: { label: "Ditunda", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  COMPLETED: { label: "Selesai", color: "bg-zinc-900 text-white" },
  CANCELLED: { label: "Dibatalkan", color: "bg-rose-50 text-rose-700 border border-rose-200" },
};

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [incurredSpend, setIncurredSpend] = useState<number>(0);
  const [transactions, setTransactions] = useState<ProjectTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        router.push("/setup-organization");
        return;
      }

      const [{ data: projData, error: projError }, { data: allocData }] =
        await Promise.all([
          supabase
            .from("projects")
            .select("*, client:clients(name)")
            .eq("id", projectId)
            .eq("organization_id", membership.organization_id)
            .single(),
          supabase
            .from("expense_allocations")
            .select("id, amount, description, expense:expenses(id, number, date, description, merchant)")
            .eq("project_id", projectId),
        ]);

      if (projError) throw projError;
      setProject(projData);

      let totalSpend = 0;
      const txs: ProjectTransaction[] = (allocData || []).map((a: any) => {
        const amt = parseFloat(a.amount || "0");
        const safeAmt = isNaN(amt) ? 0 : amt;
        totalSpend += safeAmt;
        return {
          id: a.id,
          amount: safeAmt,
          description: a.description,
          expense: a.expense,
        };
      });

      setIncurredSpend(totalSpend);
      setTransactions(txs);
    } catch (error) {
      console.error("Error fetching project:", error);
      router.push("/projects");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500">Data proyek tidak ditemukan</p>
          <Link href="/projects" className="mt-4 text-zinc-900 font-semibold hover:underline inline-block">
            Kembali ke Daftar Proyek
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[project.status] || statusConfig.PLANNING;
  const rawContract = parseFloat(project.contract_value || "0");
  const contractVal = isNaN(rawContract) ? 0 : rawContract;
  const variance = contractVal - incurredSpend;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Portofolio Proyek</span>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 font-mono">{project.code}</p>
        </div>
      </div>

      {/* Project Info Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:col-span-2 shadow-sm">
          <h2 className="text-base font-bold text-zinc-900 mb-5 pb-3 border-b border-zinc-100">
            Spesifikasi &amp; Detail Proyek
          </h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Klien / Pemberi Tugas</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Building2 className="h-4 w-4 text-zinc-400" />
                {project.client?.name || "Klien Langsung"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Jenis Layanan</dt>
              <dd className="mt-1.5 text-sm font-semibold text-zinc-900 capitalize">
                {project.type ? project.type.toLowerCase().replace(/_/g, " ") : "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Lokasi Proyek</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <MapPin className="h-4 w-4 text-zinc-400" />
                {project.location || "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nilai Kontrak</dt>
              <dd className="mt-1.5 text-sm font-mono font-bold text-zinc-900">
                {contractVal > 0 ? formatCurrency(contractVal) : "Belum ditentukan"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Tanggal Mulai</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {project.start_date ? formatDate(project.start_date) : "-"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Target Serah Terima</dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {project.end_date ? formatDate(project.end_date) : "-"}
              </dd>
            </div>
          </dl>

          {project.description && (
            <div className="mt-6 pt-5 border-t border-zinc-100">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Deskripsi / Konsep Proyek</dt>
              <dd className="mt-2 text-sm text-zinc-600 leading-relaxed">{project.description}</dd>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-[#09090B] p-6 text-white shadow-sm">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">Total Nilai Kontrak</div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-white">
              {contractVal > 0 ? formatCurrency(contractVal) : "Belum ditentukan"}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-4">
              <TrendingUp className="h-4 w-4 text-zinc-900" />
              Ringkasan Finansial Proyek
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Status Proyek</span>
                <span className={`font-medium ${status.color} px-2 py-0.5 rounded text-[11px]`}>
                  {status.label}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Nilai Kontrak</span>
                <span className="font-semibold text-zinc-900 font-mono">
                  {formatCurrency(contractVal)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Biaya Terserap (HPP)</span>
                <span className="font-semibold text-rose-600 font-mono">
                  {formatCurrency(incurredSpend)}
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-zinc-100 pt-2">
                <span className="text-zinc-500 font-semibold">Sisa Laba / Varians</span>
                <span className={`font-semibold font-mono ${variance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {formatCurrency(variance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger & Cost Transactions */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-bold text-zinc-900">Alokasi Biaya &amp; Transaksi Pengeluaran</h2>
          <span className="text-xs text-zinc-400">{transactions.length} transaksi dialokasikan</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-zinc-300" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900">Belum ada transaksi biaya dialokasikan</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Pengeluaran bahan material, upah tukang, dan sewa alat yang dialokasikan ke proyek ini akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">No. Voucher</th>
                  <th className="py-3">Tanggal</th>
                  <th className="py-3">Deskripsi / Toko</th>
                  <th className="py-3 text-right pr-6">Nominal Alokasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 px-6 font-mono font-bold text-zinc-900">
                      {tx.expense?.number || "-"}
                    </td>
                    <td className="py-3 font-mono text-zinc-500">
                      {tx.expense?.date ? new Date(tx.expense.date).toISOString().split("T")[0] : "-"}
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-zinc-900">
                        {tx.description || tx.expense?.description || "Alokasi Biaya Proyek"}
                      </span>
                      {tx.expense?.merchant && (
                        <span className="block text-[11px] text-zinc-400">
                          {tx.expense.merchant}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right font-mono font-bold text-zinc-900 tabular-nums">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
