"use client";

import { useState, useEffect } from "react";
import { X, FileText, Calendar, Building2, DollarSign, Loader2, Check } from "lucide-react";
import { createInvoiceRecord, updateInvoiceRecord } from "@/app/actions/invoiceActions";
import { createClient } from "@/lib/supabase/client";

export interface InvoiceFormData {
  id?: string;
  number: string;
  client_id?: string;
  client_name: string;
  project_id?: string;
  project?: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" | "CREDIT_NOTE";
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoice: InvoiceFormData) => void;
  invoiceToEdit?: InvoiceFormData | null;
}

export function InvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  invoiceToEdit,
}: InvoiceModalProps) {
  const isEditing = Boolean(invoiceToEdit && invoiceToEdit.id);

  const [formData, setFormData] = useState<InvoiceFormData>({
    number: "",
    client_id: "",
    client_name: "",
    project_id: "",
    project: "",
    invoice_date: "",
    due_date: "",
    total: 0,
    amount_paid: 0,
    status: "ISSUED",
  });

  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load available clients and projects for dropdowns
    const loadRelations = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!membership) return;

        const [{ data: clientsData }, { data: projectsData }] = await Promise.all([
          supabase
            .from("clients")
            .select("id, name")
            .eq("organization_id", membership.organization_id)
            .order("name"),
          supabase
            .from("projects")
            .select("id, name, code")
            .eq("organization_id", membership.organization_id)
            .order("name"),
        ]);

        if (clientsData) setClientsList(clientsData);
        if (projectsData) setProjectsList(projectsData);
      } catch (err) {
        console.error("Error loading clients/projects:", err);
      }
    };

    loadRelations();

    if (invoiceToEdit) {
      setFormData({
        id: invoiceToEdit.id,
        number: invoiceToEdit.number || "",
        client_id: invoiceToEdit.client_id || "",
        client_name: invoiceToEdit.client_name || "",
        project_id: invoiceToEdit.project_id || "",
        project: invoiceToEdit.project || "",
        invoice_date: invoiceToEdit.invoice_date || "",
        due_date: invoiceToEdit.due_date || "",
        total: invoiceToEdit.total || 0,
        amount_paid: invoiceToEdit.amount_paid || 0,
        status: invoiceToEdit.status || "ISSUED",
      });
    } else {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      const today = new Date().toISOString().split("T")[0];
      const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

      setFormData({
        number: `INV-${year}-${randNum}`,
        client_id: "",
        client_name: "",
        project_id: "",
        project: "",
        invoice_date: today,
        due_date: dueDate,
        total: 0,
        amount_paid: 0,
        status: "ISSUED",
      });
    }
    setErrorMsg(null);
  }, [invoiceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number.trim()) {
      setErrorMsg("Nomor invoice wajib diisi.");
      return;
    }
    if (!formData.client_name.trim() && !formData.client_id) {
      setErrorMsg("Nama klien atau instansi wajib dipilih.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // If user selected or typed client, ensure client_id is resolved if possible
      let resolvedClientId = formData.client_id;
      if (!resolvedClientId && formData.client_name) {
        const matched = clientsList.find(
          (c) => c.name.toLowerCase() === formData.client_name.trim().toLowerCase()
        );
        if (matched) {
          resolvedClientId = matched.id;
        } else {
          // Create client record in database
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          const { data: membership } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("profile_id", user?.id)
            .limit(1)
            .maybeSingle();

          if (membership) {
            const { data: newClient } = await supabase
              .from("clients")
              .insert({
                organization_id: membership.organization_id,
                name: formData.client_name.trim(),
              })
              .select("id")
              .single();

            if (newClient) resolvedClientId = newClient.id;
          }
        }
      }

      let savedRecord: any = null;
      if (isEditing && formData.id) {
        savedRecord = await updateInvoiceRecord(formData.id, {
          number: formData.number,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          total: Number(formData.total) || 0,
          amount_paid: Number(formData.amount_paid) || 0,
          client_id: resolvedClientId || undefined,
          project_id: formData.project_id || undefined,
          status: formData.status as any,
        });
      } else {
        savedRecord = await createInvoiceRecord({
          number: formData.number,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          total: Number(formData.total) || 0,
          amount_paid: Number(formData.amount_paid) || 0,
          client_id: resolvedClientId || undefined,
          project_id: formData.project_id || undefined,
          status: formData.status as any,
        });
      }

      onSuccess(savedRecord || { ...formData, client_id: resolvedClientId });
      onClose();
    } catch (err: any) {
      console.error("Save invoice error:", err);
      setErrorMsg(err?.message || "Gagal menyimpan invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Invoice Klien" : "Terbitkan Invoice Termin Baru"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Perbarui detail termin, pembayaran masuk, dan tanggal jatuh tempo"
                : "Catat invoice piutang termin proyek atau jasa desain"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Ref Number */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Nomor Invoice *
              </label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g. INV-2026-0001"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Status Pembayaran
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="ISSUED">ISSUED (Menunggu Pembayaran)</option>
                <option value="PARTIAL">PARTIAL (Dibayar Sebagian)</option>
                <option value="PAID">PAID (Lunas 100%)</option>
                <option value="OVERDUE">OVERDUE (Jatuh Tempo Terlewati)</option>
                <option value="DRAFT">DRAFT (Draft Internal)</option>
                <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Select / Name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Klien / Pemberi Tugas *
              </label>
              {clientsList.length > 0 ? (
                <select
                  value={formData.client_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const c = clientsList.find((item) => item.id === selectedId);
                    setFormData({
                      ...formData,
                      client_id: selectedId,
                      client_name: c ? c.name : formData.client_name,
                    });
                  }}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                >
                  <option value="">Pilih Klien Terdaftar...</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, client_name: e.target.value })
                    }
                    placeholder="Nama klien / perusahaan..."
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Project Select */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Proyek Terkait
              </label>
              {projectsList.length > 0 ? (
                <select
                  value={formData.project_id || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const p = projectsList.find((item) => item.id === selectedId);
                    setFormData({
                      ...formData,
                      project_id: selectedId,
                      project: p ? p.name : "",
                    });
                  }}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                >
                  <option value="">Pilih Proyek (Opsional)...</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.project || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                  placeholder="Keterangan termin / milestone..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Tanggal Terbit
              </label>
              <input
                type="date"
                required
                value={formData.invoice_date}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_date: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Jatuh Tempo
              </label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Billing */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Nilai Tagihan Total (IDR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  required
                  value={formData.total || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3.5 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Amount Paid */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Telah Dibayar (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.amount_paid || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount_paid: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3.5 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? "Simpan Perubahan" : "Terbitkan Invoice"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
