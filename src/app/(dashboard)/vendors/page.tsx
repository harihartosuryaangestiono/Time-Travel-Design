"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Building2,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  DollarSign,
  ShieldCheck,
  Edit3,
  Trash2,
  AlertCircle,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { VendorModal, VendorFormData } from "@/components/modals/VendorModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteVendorRecord } from "@/app/actions/vendorActions";

interface VendorItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  total_spend: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<VendorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (!membership) return;

      // 1. Ambil seluruh vendor
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("name");

      if (vendorError) {
        throw new Error(vendorError.message);
      }

      // 2. Ambil pengeluaran terkait vendor (berdasarkan merchant name)
      const { data: expenseData } = await supabase
        .from("expenses")
        .select("merchant, amount")
        .eq("organization_id", membership.organization_id);

      const spendMap: Record<string, number> = {};
      if (expenseData) {
        expenseData.forEach((exp: any) => {
          if (exp.merchant) {
            const mKey = exp.merchant.trim().toLowerCase();
            const val = parseFloat(exp.amount || "0");
            spendMap[mKey] = (spendMap[mKey] || 0) + (isNaN(val) ? 0 : val);
          }
        });
      }

      if (vendorData) {
        const mapped: VendorItem[] = vendorData.map((v) => {
          const vKey = (v.name || "").trim().toLowerCase();
          const totalSpend = spendMap[vKey] || 0;

          return {
            id: v.id,
            name: v.name,
            email: v.email,
            phone: v.phone,
            address: v.address,
            tax_id: v.tax_id,
            bank_name: v.bank_name,
            bank_account: v.bank_account,
            bank_holder: v.bank_holder,
            total_spend: totalSpend,
          };
        });
        setVendors(mapped);
      }
    } catch (e: any) {
      console.error("Gagal memuat vendor:", e);
      setErrorMessage(e.message || "Gagal memuat data vendor.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSaveVendor = async () => {
    await fetchVendors();
  };

  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;
    try {
      setIsDeleting(true);
      await deleteVendorRecord(vendorToDelete.id);
      setShowDelete(false);
      setVendorToDelete(null);
      await fetchVendors();
    } catch (err: any) {
      alert(`Gagal menghapus vendor: ${err.message || "Terjadi kesalahan"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalSpendAll = vendors.reduce((s, v) => s + (v.total_spend || 0), 0);
  const vendorsWithBanking = vendors.filter(
    (v) => Boolean(v.bank_name && v.bank_account)
  ).length;

  const filteredVendors = vendors.filter((v) => {
    const s = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(s) ||
      (v.address && v.address.toLowerCase().includes(s)) ||
      (v.email && v.email.toLowerCase().includes(s)) ||
      (v.phone && v.phone.toLowerCase().includes(s)) ||
      (v.bank_name && v.bank_name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Mitra Vendor"
          value={isLoading ? "..." : `${vendors.length} Vendor`}
          subtitle="Supplier material dan jasa"
          icon={Building2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Total Belanja Terdata"
          value={isLoading ? "..." : formatCurrency(totalSpendAll)}
          subtitle="Akumulasi pengeluaran material"
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Rekening Terverifikasi"
          value={isLoading ? "..." : `${vendorsWithBanking} Vendor`}
          subtitle={
            vendors.length > 0
              ? `${Math.round((vendorsWithBanking / vendors.length) * 100)}% siap transfer bank`
              : "Belum ada vendor"
          }
          icon={ShieldCheck}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Vendor Aktif"
          value={isLoading ? "..." : `${vendors.filter((v) => v.total_spend > 0).length} Aktif`}
          subtitle="Memiliki transaksi pengeluaran tercatat"
          icon={Truck}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchVendors()}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Control Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama vendor, bank, kontak, atau alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedVendor(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Vendor</span>
        </button>
      </div>

      {/* ── Vendors Cards Grid ── */}
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
            >
              <div className="h-4 w-28 bg-zinc-100 rounded mb-4" />
              <div className="h-6 w-3/4 bg-zinc-100 rounded mb-4" />
              <div className="space-y-2 mb-4">
                <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                <div className="h-3 w-2/3 bg-zinc-100 rounded" />
              </div>
              <div className="h-8 w-full bg-zinc-50 rounded mt-auto" />
            </div>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-4">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            {search ? "Vendor Tidak Ditemukan" : "Belum Ada Data Vendor"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-6">
            {search
              ? `Tidak ada vendor yang cocok dengan kata kunci "${search}".`
              : "Daftarkan supplier material dan jasa untuk memudahkan pencatatan biaya dan nomor rekening transfer."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedVendor(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Vendor Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-zinc-300 hover:shadow-md transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-mono font-bold text-zinc-800">
                    {vendor.bank_name || "Mitra Pengadaan"}
                  </span>
                  {vendor.tax_id && (
                    <span className="font-mono text-[10px] text-zinc-400">
                      NPWP: {vendor.tax_id}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-zinc-950 group-hover:text-black transition-colors">
                    {vendor.name}
                  </h3>
                </div>

                {/* Contact & Banking Info */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 text-xs text-zinc-600">
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.bank_account && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="font-mono text-zinc-700">
                        {vendor.bank_name ? `${vendor.bank_name}: ` : ""}
                        {vendor.bank_account}
                        {vendor.bank_holder ? ` a/n ${vendor.bank_holder}` : ""}
                      </span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-zinc-500">{vendor.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase text-zinc-400 font-bold block">
                    Total Belanja
                  </span>
                  <span className="font-mono font-bold text-zinc-950">
                    {formatCurrency(vendor.total_spend)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendor({
                        id: vendor.id,
                        name: vendor.name,
                        email: vendor.email || "",
                        phone: vendor.phone || "",
                        address: vendor.address || "",
                        tax_id: vendor.tax_id || "",
                        bank_name: vendor.bank_name || "",
                        bank_account: vendor.bank_account || "",
                        bank_holder: vendor.bank_holder || "",
                      });
                      setShowModal(true);
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                    title="Edit Vendor"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVendorToDelete(vendor);
                      setShowDelete(true);
                    }}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Hapus Vendor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Edit / Create ── */}
      <VendorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSaveVendor}
        vendorToEdit={selectedVendor}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setVendorToDelete(null);
        }}
        onConfirm={handleDeleteVendor}
        title="Hapus Vendor"
        description={`Apakah Anda yakin ingin menghapus data "${vendorToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
