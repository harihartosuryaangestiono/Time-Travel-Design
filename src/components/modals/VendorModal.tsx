"use client";

import { useState, useEffect } from "react";
import { X, Building2, Mail, Phone, MapPin, CreditCard, FileText, Loader2, Check } from "lucide-react";
import { createVendorRecord, updateVendorRecord } from "@/app/actions/vendorActions";
import { FormField } from "@/components/ui/FormField";

export interface VendorFormData {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
}

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vendor: any) => void;
  vendorToEdit?: VendorFormData | null;
}

export function VendorModal({
  isOpen,
  onClose,
  onSuccess,
  vendorToEdit,
}: VendorModalProps) {
  const isEditing = Boolean(vendorToEdit && vendorToEdit.id);

  const [formData, setFormData] = useState<VendorFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_id: "",
    bank_name: "",
    bank_account: "",
    bank_holder: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (vendorToEdit) {
      setFormData({
        id: vendorToEdit.id,
        name: vendorToEdit.name || "",
        email: vendorToEdit.email || "",
        phone: vendorToEdit.phone || "",
        address: vendorToEdit.address || "",
        tax_id: vendorToEdit.tax_id || "",
        bank_name: vendorToEdit.bank_name || "",
        bank_account: vendorToEdit.bank_account || "",
        bank_holder: vendorToEdit.bank_holder || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        tax_id: "",
        bank_name: "",
        bank_account: "",
        bank_holder: "",
      });
    }
    setErrorMsg(null);
  }, [vendorToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Nama Vendor / Supplier wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let savedRecord;
      if (isEditing && formData.id) {
        savedRecord = await updateVendorRecord(formData.id, {
          name: formData.name.trim(),
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          tax_id: formData.tax_id?.trim() || undefined,
          bank_name: formData.bank_name?.trim() || undefined,
          bank_account: formData.bank_account?.trim() || undefined,
          bank_holder: formData.bank_holder?.trim() || undefined,
        });
      } else {
        savedRecord = await createVendorRecord({
          name: formData.name.trim(),
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          tax_id: formData.tax_id?.trim() || undefined,
          bank_name: formData.bank_name?.trim() || undefined,
          bank_account: formData.bank_account?.trim() || undefined,
          bank_holder: formData.bank_holder?.trim() || undefined,
        });
      }

      onSuccess(savedRecord);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan data vendor.");
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
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Profil Vendor / Supplier" : "Daftarkan Vendor Baru"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Perbarui nomor kontak, alamat pengiriman, dan rekening pencairan"
                : "Tambahkan mitra pengadaan material dan subkontraktor ke database"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vendor Name */}
          <FormField id="vendor-name" label="Nama vendor / pemasok" required>
            <input
              id="vendor-name"
              type="text"
              required
              maxLength={150}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: PT Marmer Indah Sentosa atau CV Cipta Tata Cahaya"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email */}
            <FormField id="vendor-email" label="Email kontak">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  id="vendor-email"
                  type="email"
                  maxLength={254}
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sales@vendor.co.id"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </FormField>

            {/* Phone */}
            <FormField id="vendor-phone" label="Telepon / WhatsApp">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  id="vendor-phone"
                  type="text"
                  inputMode="tel"
                  maxLength={30}
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+62 21 5567..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </FormField>
          </div>

          {/* Address */}
          <FormField id="vendor-address" label="Alamat kantor / workshop">
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-400" />
              <textarea
                id="vendor-address"
                rows={2}
                maxLength={500}
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Jl. Daan Mogot KM 12, Kawasan Industri, Jakarta Barat"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none resize-none"
              />
            </div>
          </FormField>

          {/* Bank Info Grid */}
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <CreditCard className="h-4 w-4 text-zinc-500" />
              <span>Informasi Rekening Bank Pembayaran</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField id="vendor-bank-name" label="Nama bank">
                <input
                  id="vendor-bank-name"
                  type="text"
                  maxLength={100}
                  value={formData.bank_name || ""}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="BCA / Mandiri"
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </FormField>
              <FormField id="vendor-bank-account" label="Nomor rekening">
                <input
                  id="vendor-bank-account"
                  type="text"
                  inputMode="numeric"
                  maxLength={50}
                  value={formData.bank_account || ""}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  placeholder="1234567890"
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </FormField>
              <FormField id="vendor-bank-holder" label="Nama pemilik rekening">
                <input
                  id="vendor-bank-holder"
                  type="text"
                  maxLength={150}
                  value={formData.bank_holder || ""}
                  onChange={(e) => setFormData({ ...formData, bank_holder: e.target.value })}
                  placeholder="PT Marmer Indah"
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </FormField>
            </div>
          </div>

          {/* Tax ID */}
          <FormField id="vendor-tax-id" label="NPWP">
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                id="vendor-tax-id"
                type="text"
                maxLength={30}
                value={formData.tax_id || ""}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="01.234.567.8-000.000"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 font-mono text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </FormField>

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
                  <span>{isEditing ? "Simpan Perubahan" : "Daftarkan Vendor"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
