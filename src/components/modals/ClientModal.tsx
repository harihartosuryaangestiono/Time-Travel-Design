"use client";

import { useState, useEffect } from "react";
import { X, Users, Mail, Phone, MapPin, FileText, Loader2, Check } from "lucide-react";
import { createClientRecord, updateClientRecord } from "@/app/actions/clientActions";

export interface ClientFormData {
  id?: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
}

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client: ClientFormData) => void;
  clientToEdit?: ClientFormData | null;
}

export function ClientModal({
  isOpen,
  onClose,
  onSuccess,
  clientToEdit,
}: ClientModalProps) {
  const isEditing = Boolean(clientToEdit && clientToEdit.id);

  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    tax_id: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        id: clientToEdit.id,
        name: clientToEdit.name || "",
        contact_person: clientToEdit.contact_person || "",
        email: clientToEdit.email || "",
        phone: clientToEdit.phone || "",
        address: clientToEdit.address || "",
        tax_id: clientToEdit.tax_id || "",
      });
    } else {
      setFormData({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        tax_id: "",
      });
    }
    setErrorMsg(null);
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Nama Klien / Perusahaan wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let savedRecord;
      if (isEditing && formData.id) {
        savedRecord = await updateClientRecord(formData.id, {
          name: formData.name.trim(),
          contact_person: formData.contact_person?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          tax_id: formData.tax_id?.trim() || undefined,
        });
      } else {
        savedRecord = await createClientRecord({
          name: formData.name.trim(),
          contact_person: formData.contact_person?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          tax_id: formData.tax_id?.trim() || undefined,
        });
      }

      onSuccess(savedRecord as ClientFormData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan data klien.");
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
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Profil Klien" : "Tambah Klien Baru"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Perbarui informasi kontak, alamat, dan nomor pajak klien"
                : "Daftarkan akun klien baru untuk penagihan dan proyek"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Nama Klien / Perusahaan *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: PT Bali Resort Investama atau Hendra Gunawan"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Contact Person / PIC
            </label>
            <input
              type="text"
              value={formData.contact_person || ""}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="Contoh: Bpk. Andi Pratama"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Email Kontak
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kontak@perusahaan.com"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Telepon / WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+62 811..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Alamat Lengkap
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-400" />
              <textarea
                rows={2}
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Jl. Sunset Road No. 88, Kuta, Bali"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Tax ID */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Nomor Pokok Wajib Pajak (NPWP)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={formData.tax_id || ""}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="01.234.567.8-901.000"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 font-mono text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
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
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? "Simpan Perubahan" : "Daftarkan Klien"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
