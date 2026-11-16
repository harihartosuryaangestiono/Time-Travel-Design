"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  HardHat,
  Plus,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Check,
  X,
  CreditCard,
  Search,
  Filter,
  FileText,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import {
  getProjectLaborRecap,
  getLaborClaims,
  submitLaborClaim,
  verifyLaborClaim,
  approveLaborClaim,
  rejectLaborClaim,
  payLaborClaim,
  createProjectLaborItem,
  ProjectLaborContractItem,
  LaborClaimItem,
} from "@/app/actions/cost-control/laborActions";
import { getProjects } from "@/app/actions/projectActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function LaborRecapPage() {
  const [contracts, setContracts] = useState<ProjectLaborContractItem[]>([]);
  const [claims, setClaims] = useState<LaborClaimItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [cashAccounts, setCashAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"CONTRACTS" | "CLAIMS">("CONTRACTS");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const [selectedContract, setSelectedContract] = useState<ProjectLaborContractItem | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<LaborClaimItem | null>(null);

  // Form states
  const [newContractForm, setNewContractForm] = useState({
    project_id: "",
    mandor_name: "",
    job_name: "",
    category: "Pekerjaan Lantai & Dinding",
    specifications: "",
    unit: "m²",
    payment_system: "BORONGAN" as const,
    contract_volume: 100,
    unit_rate: 75000,
    notes: "",
  });

  const [claimForm, setClaimForm] = useState({
    claimed_volume: 0,
    work_description: "",
    supervisor_notes: "",
  });

  const [verifyForm, setVerifyForm] = useState({
    verified_volume: 0,
    supervisor_notes: "",
  });

  const [payForm, setPayForm] = useState({
    cash_account_id: "",
    amount: 0,
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [recapData, claimsData, projList, accounts] = await Promise.all([
        getProjectLaborRecap(selectedProjectId),
        getLaborClaims({ projectId: selectedProjectId }),
        getProjects(),
        getCashAccountsWithBalances(),
      ]);
      setContracts(recapData);
      setClaims(claimsData);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      setCashAccounts((accounts || []).map((a: any) => ({ id: a.id, name: a.name })));
      if (accounts && accounts.length > 0) {
        setPayForm((prev) => ({ ...prev, cash_account_id: accounts[0].id }));
      }
    } catch (err: any) {
      console.error("Gagal memuat data upah:", err);
      setError(err?.message || "Gagal memuat rekapitulasi upah.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Totals calculations
  const totalContractValue = useMemo(() => contracts.reduce((sum, c) => sum + c.total_amount, 0), [contracts]);
  const totalPaidAmount = useMemo(() => contracts.reduce((sum, c) => sum + (c.paid_amount || 0), 0), [contracts]);
  const totalRemainingAmount = useMemo(() => contracts.reduce((sum, c) => sum + (c.remaining_amount || 0), 0), [contracts]);
  const pendingVerificationClaimsCount = useMemo(() => claims.filter((c) => c.status === "SUBMITTED").length, [claims]);
  const pendingApprovalClaimsCount = useMemo(() => claims.filter((c) => c.status === "VERIFIED").length, [claims]);

  // Filtered lists
  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const term = searchQuery.toLowerCase();
    return contracts.filter(
      (c) =>
        c.job_name.toLowerCase().includes(term) ||
        c.mandor_name.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term) ||
        c.project?.name.toLowerCase().includes(term)
    );
  }, [contracts, searchQuery]);

  const filteredClaims = useMemo(() => {
    if (!searchQuery.trim()) return claims;
    const term = searchQuery.toLowerCase();
    return claims.filter(
      (c) =>
        c.claim_number.toLowerCase().includes(term) ||
        c.mandor_name.toLowerCase().includes(term) ||
        (c.work_description || "").toLowerCase().includes(term)
    );
  }, [claims, searchQuery]);

  // Handlers
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newContractForm.project_id) throw new Error("Pilih proyek terlebih dahulu.");
      if (!newContractForm.job_name.trim()) throw new Error("Nama pekerjaan wajib diisi.");
      if (!newContractForm.mandor_name.trim()) throw new Error("Nama mandor/tukang wajib diisi.");

      await createProjectLaborItem(newContractForm);
      setSuccessMsg("Pekerjaan borongan berhasil ditambahkan.");
      setShowAddContractModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal membuat pekerjaan borongan.");
    }
  };

  const handleOpenClaimModal = (contract: ProjectLaborContractItem) => {
    setSelectedContract(contract);
    setClaimForm({
      claimed_volume: contract.remaining_volume || 10,
      work_description: `Progres pekerjaan ${contract.job_name}`,
      supervisor_notes: "",
    });
    setShowClaimModal(true);
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    try {
      await submitLaborClaim({
        project_id: selectedContract.project_id,
        labor_item_id: selectedContract.id,
        mandor_name: selectedContract.mandor_name,
        work_description: claimForm.work_description,
        claimed_volume: Number(claimForm.claimed_volume),
        unit_rate: selectedContract.unit_rate,
        supervisor_notes: claimForm.supervisor_notes,
      });
      setSuccessMsg("Pengajuan klaim upah berhasil dikirim.");
      setShowClaimModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mengajukan klaim upah.");
    }
  };

  const handleOpenVerifyModal = (claim: LaborClaimItem) => {
    setSelectedClaim(claim);
    setVerifyForm({
      verified_volume: claim.claimed_volume,
      supervisor_notes: claim.supervisor_notes || "Volume telah diukur fisik di lapangan.",
    });
    setShowVerifyModal(true);
  };

  const handleVerifyClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      await verifyLaborClaim(selectedClaim.id, Number(verifyForm.verified_volume), verifyForm.supervisor_notes);
      setSuccessMsg("Volume klaim upah berhasil diverifikasi oleh pengawas.");
      setShowVerifyModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memverifikasi klaim upah.");
    }
  };

  const handleApprove = async (claim: LaborClaimItem) => {
    try {
      const volToApprove = claim.verified_volume > 0 ? claim.verified_volume : claim.claimed_volume;
      await approveLaborClaim(claim.id, volToApprove);
      setSuccessMsg("Klaim upah berhasil disetujui.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyetujui klaim.");
    }
  };

  const handleReject = async (claim: LaborClaimItem) => {
    const reason = prompt("Alasan penolakan klaim upah:", "Volume tidak sesuai kondisi lapangan");
    if (!reason) return;
    try {
      await rejectLaborClaim(claim.id, reason);
      setSuccessMsg("Klaim upah telah ditolak.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menolak klaim.");
    }
  };

  const handleOpenPayModal = (claim: LaborClaimItem) => {
    setSelectedClaim(claim);
    setPayForm({
      cash_account_id: cashAccounts[0]?.id || "",
      amount: claim.approved_amount,
      notes: `Pembayaran klaim #${claim.claim_number} untuk ${claim.mandor_name}`,
    });
    setShowPayModal(true);
  };

  const handlePayClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      await payLaborClaim({
        claim_id: selectedClaim.id,
        cash_account_id: payForm.cash_account_id,
        amount: Number(payForm.amount),
        notes: payForm.notes,
      });
      setSuccessMsg("Pembayaran upah berhasil dicatat dan terintegrasi ke Buku Kas.");
      setShowPayModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memproses pembayaran upah.");
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <HardHat className="h-3.5 w-3.5" />
            Manajemen Tenaga Kerja Konstruksi
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Rekapitulasi Upah Tukang
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Pusat pemantauan kontrak borongan, pengajuan klaim, verifikasi volume pengawas, dan pembayaran terintegrasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs shadow-sm">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (projects.length > 0 && !newContractForm.project_id) {
                setNewContractForm((prev) => ({ ...prev, project_id: projects[0].id }));
              }
              setShowAddContractModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Kontrak Pekerjaan
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nilai Kontrak Borongan"
          value={formatCurrency(totalContractValue)}
          subtitle={`${contracts.length} paket pekerjaan aktif`}
          icon={HardHat}
        />
        <StatCard
          title="Total Upah Terbayar"
          value={formatCurrency(totalPaidAmount)}
          subtitle={`${totalContractValue > 0 ? Math.round((totalPaidAmount / totalContractValue) * 100) : 0}% dari kontrak`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Sisa Nilai Upah (Outstanding)"
          value={formatCurrency(totalRemainingAmount)}
          subtitle="Sisa komitmen tenaga kerja"
          icon={Clock}
        />
        <StatCard
          title="Antrean Klaim Pending"
          value={`${pendingVerificationClaimsCount + pendingApprovalClaimsCount} Klaim`}
          subtitle={`${pendingVerificationClaimsCount} butuh ukur • ${pendingApprovalClaimsCount} butuh approval`}
          icon={FileText}
        />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("CONTRACTS")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "CONTRACTS"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Daftar Kontrak & Rekap Progres ({contracts.length})
          </button>
          <button
            onClick={() => setActiveTab("CLAIMS")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "CLAIMS"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Pengajuan Klaim & Approval ({claims.length})
            {pendingVerificationClaimsCount + pendingApprovalClaimsCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] text-white">
                {pendingVerificationClaimsCount + pendingApprovalClaimsCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari mandor, pekerjaan, proyek..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* TAB 1: CONTRACTS & VOLUME SUMMARY TABLE */}
      {activeTab === "CONTRACTS" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Pekerjaan & Proyek</th>
                  <th className="px-4 py-3.5">Mandor / Tukang</th>
                  <th className="px-4 py-3.5">Sistem</th>
                  <th className="px-4 py-3.5 text-right">Vol Kontrak</th>
                  <th className="px-4 py-3.5 text-right">Tarif Satuan</th>
                  <th className="px-4 py-3.5 text-right">Total Nilai</th>
                  <th className="px-4 py-3.5 text-right">Vol Dikerjakan</th>
                  <th className="px-4 py-3.5 text-right">Vol Disetujui</th>
                  <th className="px-4 py-3.5 text-right">Vol Dibayar</th>
                  <th className="px-4 py-3.5 text-right">Sisa Upah</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredContracts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-400">
                      Belum ada paket pekerjaan upah borongan tercatat.
                    </td>
                  </tr>
                ) : (
                  filteredContracts.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        <div>{item.job_name}</div>
                        <div className="text-[10px] font-normal text-zinc-400">
                          {item.project?.code} • {item.category}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-800 font-medium">{item.mandor_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{item.payment_system}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {item.contract_volume} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-950">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {item.claimed_volume || 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {item.approved_volume || 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">
                        {item.paid_volume ? item.paid_volume.toFixed(1) : 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-900">
                        {formatCurrency(item.remaining_amount || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenClaimModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 shadow-xs"
                        >
                          <Plus className="h-3 w-3" /> Ajukan Klaim
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CLAIMS APPROVAL & VERIFICATION TABLE */}
      {activeTab === "CLAIMS" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">No Klaim & Tanggal</th>
                  <th className="px-4 py-3.5">Proyek & Mandor</th>
                  <th className="px-4 py-3.5">Uraian Pekerjaan</th>
                  <th className="px-4 py-3.5 text-right">Vol Klaim</th>
                  <th className="px-4 py-3.5 text-right">Vol Verifikasi</th>
                  <th className="px-4 py-3.5 text-right">Vol Disetujui</th>
                  <th className="px-4 py-3.5 text-right">Total Tagihan</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi / Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">
                      Belum ada klaim tagihan upah diajukan.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        <div>{claim.claim_number}</div>
                        <div className="text-[10px] font-normal text-zinc-400">
                          {new Date(claim.claim_date).toLocaleDateString("id-ID")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{claim.mandor_name}</div>
                        <div className="text-[10px] text-zinc-400">{claim.project?.code}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-zinc-700">
                        {claim.work_description || "-"}
                        {claim.supervisor_notes && (
                          <div className="text-[10px] text-blue-600">Catatan: {claim.supervisor_notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{claim.claimed_volume}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                        {claim.status === "SUBMITTED" ? (
                          <span className="text-amber-600 font-normal">Belum diverifikasi</span>
                        ) : (
                          `${claim.verified_volume}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {claim.approved_volume > 0 ? claim.approved_volume : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(claim.approved_amount > 0 ? claim.approved_amount : claim.claimed_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            claim.status === "PAID"
                              ? "success"
                              : claim.status === "APPROVED"
                              ? "info"
                              : claim.status === "VERIFIED"
                              ? "warning"
                              : claim.status === "REJECTED"
                              ? "error"
                              : "neutral"
                          }
                        >
                          {claim.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {claim.status === "SUBMITTED" && (
                            <button
                              onClick={() => handleOpenVerifyModal(claim)}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-xs"
                            >
                              Ukur / Verifikasi
                            </button>
                          )}

                          {claim.status === "VERIFIED" && (
                            <>
                              <button
                                onClick={() => handleApprove(claim)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-xs"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => handleReject(claim)}
                                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                              >
                                Tolak
                              </button>
                            </>
                          )}

                          {claim.status === "APPROVED" && (
                            <button
                              onClick={() => handleOpenPayModal(claim)}
                              className="rounded-lg bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black shadow-xs flex items-center gap-1"
                            >
                              <CreditCard className="h-3 w-3" /> Bayar Kas
                            </button>
                          )}

                          {claim.status === "PAID" && (
                            <span className="text-[11px] text-zinc-400 font-medium">Lunas</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: TAMBAH KONTRAK BORONGAN */}
      {showAddContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Tambah Paket Kontrak Borongan</h3>
              <button onClick={() => setShowAddContractModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Proyek</label>
                <select
                  value={newContractForm.project_id}
                  onChange={(e) => setNewContractForm({ ...newContractForm, project_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                >
                  <option value="">-- Pilih Proyek --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} • {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Nama Pekerjaan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pasang Keramik 60x60"
                    value={newContractForm.job_name}
                    onChange={(e) => setNewContractForm({ ...newContractForm, job_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Nama Mandor / Tukang</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pak Budi"
                    value={newContractForm.mandor_name}
                    onChange={(e) => setNewContractForm({ ...newContractForm, mandor_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Volume Kontrak</label>
                  <input
                    type="number"
                    step="any"
                    value={newContractForm.contract_volume}
                    onChange={(e) => setNewContractForm({ ...newContractForm, contract_volume: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan</label>
                  <input
                    type="text"
                    value={newContractForm.unit}
                    onChange={(e) => setNewContractForm({ ...newContractForm, unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tarif Satuan (Rp)</label>
                  <input
                    type="number"
                    value={newContractForm.unit_rate}
                    onChange={(e) => setNewContractForm({ ...newContractForm, unit_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 flex justify-between items-center">
                <span>Total Estimasi Nilai Kontrak:</span>
                <span className="font-bold text-zinc-900">
                  {formatCurrency(newContractForm.contract_volume * newContractForm.unit_rate)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddContractModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Simpan Kontrak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PENGAJUAN KLAIM UPAH */}
      {showClaimModal && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Ajukan Tagihan Klaim Upah</h3>
                <p className="text-xs text-zinc-500">{selectedContract.job_name} • Mandor: {selectedContract.mandor_name}</p>
              </div>
              <button onClick={() => setShowClaimModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">
                  Volume Ditagihkan ({selectedContract.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={claimForm.claimed_volume}
                  onChange={(e) => setClaimForm({ ...claimForm, claimed_volume: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Sisa volume kontrak: {selectedContract.remaining_volume} {selectedContract.unit}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Uraian / Area Pengerjaan</label>
                <textarea
                  rows={2}
                  value={claimForm.work_description}
                  onChange={(e) => setClaimForm({ ...claimForm, work_description: e.target.value })}
                  placeholder="Contoh: Pemasangan keramik lantai 1 area ruang tamu & teras"
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs flex justify-between items-center">
                <span className="text-zinc-600">Total Klaim Tagihan:</span>
                <span className="font-bold text-zinc-950">
                  {formatCurrency(claimForm.claimed_volume * selectedContract.unit_rate)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VERIFIKASI VOLUME OLEH PENGAWAS */}
      {showVerifyModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Verifikasi Fisik Pengawas</h3>
                <p className="text-xs text-zinc-500">Klaim #{selectedClaim.claim_number} ({selectedClaim.mandor_name})</p>
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyClaim} className="mt-4 space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Volume yang diklaim tukang: <strong>{selectedClaim.claimed_volume}</strong>. Harap lakukan pengukuran aktual terpasang di lapangan.
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Volume Terverifikasi Pengawas</label>
                <input
                  type="number"
                  step="any"
                  value={verifyForm.verified_volume}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verified_volume: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Pengawas Lapangan</label>
                <textarea
                  rows={2}
                  value={verifyForm.supervisor_notes}
                  onChange={(e) => setVerifyForm({ ...verifyForm, supervisor_notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs flex justify-between items-center">
                <span className="text-zinc-600">Nilai Valid Terverifikasi:</span>
                <span className="font-bold text-zinc-950">
                  {formatCurrency(verifyForm.verified_volume * selectedClaim.unit_rate)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Simpan Verifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PEMBAYARAN KAS & BANK TERINTEGRASI */}
      {showPayModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Catat Pembayaran Upah</h3>
                <p className="text-xs text-zinc-500">Klaim #{selectedClaim.claim_number} • {selectedClaim.mandor_name}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePayClaim} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Rekening Kas / Bank Pembayar</label>
                <select
                  value={payForm.cash_account_id}
                  onChange={(e) => setPayForm({ ...payForm, cash_account_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {cashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Transaksi</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                Transaksi ini otomatis dicatat sebagai pengeluaran proyek kategori <strong>Upah Tukang</strong> di Buku Kas Perusahaan.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Konfirmasi Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
