"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  FileText,
  Search,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Edit3,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { InvoiceModal, InvoiceFormData } from "@/components/modals/InvoiceModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteInvoiceRecord } from "@/app/actions/invoiceActions";

interface InvoiceItem {
  id: string;
  number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" | "CREDIT_NOTE";
  client?: { id?: string; name: string };
  project?: string;
  project_id?: string;
}

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchInvoices = async () => {
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

      const { data, error: fetchErr } = await supabase
        .from("invoices")
        .select("*, client:clients(id, name), project:projects(id, name)")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const mapped: InvoiceItem[] = (data || []).map((inv: any) => {
        const tot = parseFloat(inv.total || "0");
        const paid = parseFloat(inv.amount_paid || "0");
        return {
          id: inv.id,
          number: inv.number,
          invoice_date: inv.invoice_date ? new Date(inv.invoice_date).toISOString().split("T")[0] : "",
          due_date: inv.due_date ? new Date(inv.due_date).toISOString().split("T")[0] : "",
          total: isNaN(tot) ? 0 : tot,
          amount_paid: isNaN(paid) ? 0 : paid,
          status: inv.status || "ISSUED",
          client: inv.client ? { id: inv.client.id, name: inv.client.name } : undefined,
          project: inv.project?.name || undefined,
          project_id: inv.project_id || undefined,
        };
      });
      setInvoices(mapped);
    } catch (e: any) {
      console.error("Error fetching invoices:", e);
      setError(e?.message || "Gagal memuat daftar invoice piutang.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleSaveInvoice = async () => {
    await fetchInvoices();
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      setIsDeleting(true);
      await deleteInvoiceRecord(invoiceToDelete.id);
      await fetchInvoices();
      setShowDelete(false);
      setInvoiceToDelete(null);
    } catch (err: any) {
      console.error("Delete invoice error:", err);
      alert(err?.message || "Gagal menghapus invoice.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Piutang aktif: belum lunas
  const totalReceivables = invoices
    .filter((i) => i.status === "ISSUED" || i.status === "PARTIAL" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + (i.total - i.amount_paid), 0);

  // Pembayaran diterima di bulan ini
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const totalPaidThisMonth = invoices
    .filter((i) => {
      if (i.amount_paid <= 0) return false;
      const d = new Date(i.invoice_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + i.amount_paid, 0);

  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const overdueAmount = invoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((sum, i) => sum + (i.total - i.amount_paid), 0);

  const totalInvoicesBilled = invoices.reduce((sum, i) => sum + i.total, 0);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.client?.name && inv.client.name.toLowerCase().includes(search.toLowerCase())) ||
      (inv.project && inv.project.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Analytical Summary ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Piutang Termin Aktif"
          value={isLoading ? "..." : formatCurrency(totalReceivables)}
          subtitle="Tagihan termin yang belum terbayar"
          icon={FileText}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
          gradient
        />
        <StatCard
          title="Jatuh Tempo (Overdue)"
          value={isLoading ? "..." : `${overdueCount} Invoice`}
          subtitle={overdueCount > 0 ? formatCurrency(overdueAmount) : "Tidak ada piutang tertunggak"}
          icon={AlertTriangle}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        />
        <StatCard
          title="Penerimaan Bulan Ini"
          value={isLoading ? "..." : formatCurrency(totalPaidThisMonth)}
          subtitle="Uang termin klien masuk bulan ini"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Total Tagihan Diterbitkan"
          value={isLoading ? "..." : formatCurrency(totalInvoicesBilled)}
          subtitle={`${invoices.length} berkas invoice total`}
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
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
            onClick={fetchInvoices}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Controls Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor invoice, klien, atau nama proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "Semua" },
              { id: "ISSUED", label: "Menunggu" },
              { id: "PARTIAL", label: "Sebagian" },
              { id: "PAID", label: "Lunas" },
              { id: "OVERDUE", label: "Jatuh Tempo" },
              { id: "DRAFT", label: "Draft" },
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
              setSelectedInvoice(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Terbitkan Invoice</span>
          </button>
        </div>
      </div>

      {/* ── Skeleton Loading ── */}
      {isLoading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-zinc-50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && invoices.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
            <FileText className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900">Belum Ada Invoice Tagihan</h4>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Terbitkan invoice penagihan termin proyek arsitektur atau konsultasi desain untuk mencatat piutang klien.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedInvoice(null);
              setShowModal(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Terbitkan Invoice Pertama</span>
          </button>
        </div>
      )}

      {/* ── Invoices Table ── */}
      {!isLoading && invoices.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <FileText className="h-5 w-5 text-zinc-950" />
                Buku Piutang &amp; Tagihan Invoice Klien
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Pantau penerbitan termin proyek, tanggal jatuh tempo, dan status pelunasan pembayaran
              </p>
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              {filteredInvoices.length} invoice
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">No. Invoice</th>
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Klien &amp; Proyek</th>
                  <th className="pb-3">Jatuh Tempo</th>
                  <th className="pb-3 text-right">Total Tagihan</th>
                  <th className="pb-3 text-right">Telah Dibayar</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 pr-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                      {inv.number}
                    </td>
                    <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3.5 pr-2">
                      <p className="font-semibold text-zinc-900">
                        {inv.client?.name || "Klien Langsung"}
                      </p>
                      {inv.project && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {inv.project}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                      {inv.due_date}
                    </td>
                    <td className="py-3.5 font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap text-right">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-3.5 font-mono tabular-nums text-zinc-600 whitespace-nowrap text-right">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="py-3.5 text-center whitespace-nowrap">
                      <Badge
                        variant={
                          inv.status === "PAID"
                            ? "success"
                            : inv.status === "OVERDUE"
                            ? "error"
                            : inv.status === "PARTIAL"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                        dot
                      >
                        {inv.status === "PAID"
                          ? "Lunas"
                          : inv.status === "OVERDUE"
                          ? "Jatuh Tempo"
                          : inv.status === "PARTIAL"
                          ? "Sebagian"
                          : inv.status === "ISSUED"
                          ? "Menunggu"
                          : inv.status === "CANCELLED"
                          ? "Batal"
                          : "Draft"}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice({
                              id: inv.id,
                              number: inv.number,
                              client_id: inv.client?.id,
                              client_name: inv.client?.name || "",
                              project_id: inv.project_id,
                              project: inv.project || "",
                              invoice_date: inv.invoice_date,
                              due_date: inv.due_date,
                              total: inv.total,
                              amount_paid: inv.amount_paid,
                              status: inv.status,
                            });
                            setShowModal(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                          title="Edit Invoice"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceToDelete(inv);
                            setShowDelete(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus Invoice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invoice Create / Edit Modal ── */}
      <InvoiceModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedInvoice(null);
        }}
        onSuccess={handleSaveInvoice}
        invoiceToEdit={selectedInvoice}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={handleDeleteInvoice}
        title="Hapus Invoice Piutang"
        description="Apakah Anda yakin ingin menghapus dokumen invoice ini secara permanen?"
        itemName={invoiceToDelete ? `${invoiceToDelete.number} • ${invoiceToDelete.client?.name || "Klien"}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
