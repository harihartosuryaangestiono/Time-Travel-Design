"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Download,
  Upload,
  Calendar,
  Users,
  Layers,
  ChevronDown,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getProjectLaborRecap,
  getLaborClaims,
  submitLaborClaim,
  verifyLaborClaim,
  approveLaborClaim,
  rejectLaborClaim,
  payLaborClaim,
  createProjectLaborItem,
  getProjectLaborRetentions,
  createProjectLaborRetention,
  updateProjectLaborRetention,
  deleteProjectLaborRetention,
  importProjectLaborRecapBatch,
  getLaborRates,
  LaborRateItem,
  ProjectLaborContractItem,
  LaborClaimItem,
  ProjectRetentionItem,
} from "@/app/actions/cost-control/laborActions";
import { resolveLaborRatePrice } from "@/lib/cost-control/laborRatePricing";
import { getProjects } from "@/app/actions/projectActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import sampleProjectsData from "@/lib/data/rekapitulasi_upah_sample.json";

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
  const [retentions, setRetentions] = useState<ProjectRetentionItem[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRateItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [cashAccounts, setCashAccounts] = useState<Array<{ id: string; name: string }>>([]);
  
  // Project selection: default to first sample project if available
  const [selectedProjectId, setSelectedProjectId] = useState<string>("sample-0");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"BORONGAN" | "RETENSI" | "CONTRACTS" | "CLAIMS">("BORONGAN");

  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);

  const [selectedContract, setSelectedContract] = useState<ProjectLaborContractItem | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<LaborClaimItem | null>(null);

  // Form states
  const [newContractForm, setNewContractForm] = useState({
    project_id: "",
    mandor_name: "",
    labor_rate_id: "",
    job_name: "",
    category: "Pekerjaan Renovasi",
    specifications: "",
    unit: "m²",
    payment_system: "BORONGAN" as const,
    contract_volume: 10,
    unit_rate: 65000,
    notes: "",
  });

  const [opnameForm, setOpnameForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    items: [] as Array<{ id: string; job_name: string; unit_rate: number; unit: string; current_vol: number; add_vol: number }>,
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Combined projects list (Database projects + Sample projects from Dustin's Excel)
  const allProjects = useMemo(() => {
    const list = [...projects];
    // Append sample projects if not already matching by name
    sampleProjectsData.forEach((s, idx) => {
      const exists = list.some((p) => p.name.toLowerCase() === s.name.toLowerCase());
      if (!exists) {
        list.push({
          id: `sample-${idx}`,
          name: s.name,
          code: s.code,
        });
      }
    });
    return list;
  }, [projects]);

  // Active project metadata
  const currentProject = useMemo(() => {
    return allProjects.find((p) => p.id === selectedProjectId) || allProjects[0] || null;
  }, [allProjects, selectedProjectId]);

  // Is sample project
  const isSampleProject = useMemo(() => {
    return selectedProjectId.startsWith("sample-");
  }, [selectedProjectId]);

  const currentSampleData = useMemo(() => {
    if (!isSampleProject) return null;
    const idx = parseInt(selectedProjectId.replace("sample-", ""), 10);
    return sampleProjectsData[idx] || sampleProjectsData[0];
  }, [isSampleProject, selectedProjectId]);

  const primaryMandor = useMemo(() => {
    if (currentSampleData) return currentSampleData.mandor_name;
    if (contracts.length > 0) return contracts[0].mandor_name;
    return "Rian Purnama";
  }, [currentSampleData, contracts]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const isRealProject = selectedProjectId && !selectedProjectId.startsWith("sample-");
      
      const [recapData, claimsData, projList, accounts, retentionsData, laborRateList] = await Promise.all([
        getProjectLaborRecap(isRealProject ? selectedProjectId : undefined),
        getLaborClaims(isRealProject ? { projectId: selectedProjectId } : undefined),
        getProjects(),
        getCashAccountsWithBalances(),
        isRealProject ? getProjectLaborRetentions(selectedProjectId) : Promise.resolve([]),
        getLaborRates(),
      ]);

      setContracts(recapData);
      setClaims(claimsData);
      setRetentions(retentionsData);
      setLaborRates(laborRateList);
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

  const boronganLaborRates = useMemo(
    () => laborRates.filter((rate) => rate.payment_system === "BORONGAN"),
    [laborRates],
  );
  const selectedLaborRate = useMemo(
    () => boronganLaborRates.find((rate) => rate.id === newContractForm.labor_rate_id) || null,
    [boronganLaborRates, newContractForm.labor_rate_id],
  );
  const selectedLaborPricing = useMemo(
    () => selectedLaborRate
      ? resolveLaborRatePrice(selectedLaborRate, newContractForm.mandor_name)
      : null,
    [selectedLaborRate, newContractForm.mandor_name],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Display items for Borongan table (Sheet Upah)
  const displayItems = useMemo(() => {
    if (currentSampleData) {
      return currentSampleData.items.map((it: any, idx: number) => ({
        id: `sample-item-${idx}`,
        item_number: it.item_number || `${idx + 1}`,
        job_name: it.job_name,
        unit: it.unit,
        unit_rate: it.unit_rate,
        total_volume: it.total_volume,
        total_amount: it.total_amount,
        progress_records: it.progress_records || [],
      }));
    }

    return contracts.map((c, idx) => ({
      id: c.id,
      item_number: `${idx + 1}`,
      job_name: c.job_name,
      unit: c.unit,
      unit_rate: c.unit_rate,
      total_volume: c.contract_volume,
      total_amount: c.total_amount,
      progress_records: c.progress_records || [],
    }));
  }, [currentSampleData, contracts]);

  const filteredDisplayItems = useMemo(() => {
    if (!searchQuery.trim()) return displayItems;
    const term = searchQuery.toLowerCase();
    return displayItems.filter(
      (it: any) =>
        it.job_name.toLowerCase().includes(term) ||
        (it.item_number || "").toLowerCase().includes(term)
    );
  }, [displayItems, searchQuery]);

  // Display retentions for Retensi table (Sheet Retensi)
  const displayRetentions = useMemo(() => {
    if (currentSampleData) {
      return currentSampleData.retentions.map((r: any) => ({
        id: `sample-ret-${r.termin_number}`,
        termin_number: r.termin_number,
        claim_date: r.date,
        total_claim: r.total_claim,
        paid_amount: r.paid_amount,
        retention_amount: r.retention_amount,
        status: r.status,
      }));
    }

    return retentions.map((r) => ({
      id: r.id,
      termin_number: r.termin_number,
      claim_date: r.claim_date,
      total_claim: r.total_claim,
      paid_amount: r.paid_amount,
      retention_amount: r.retention_amount,
      status: r.status,
    }));
  }, [currentSampleData, retentions]);

  // KPI Calculations
  const totalBoronganAmount = useMemo(() => {
    return displayItems.reduce((acc: number, it: any) => acc + (it.total_amount || 0), 0);
  }, [displayItems]);

  const totalTagihanUpah = useMemo(() => {
    return displayRetentions.reduce((acc: number, r: any) => acc + (r.total_claim || 0), 0);
  }, [displayRetentions]);

  const totalSudahDibayar = useMemo(() => {
    return displayRetentions.reduce((acc: number, r: any) => acc + (r.paid_amount || 0), 0);
  }, [displayRetentions]);

  const totalRetensiTertahan = useMemo(() => {
    return displayRetentions.reduce(
      (acc: number, r: any) => acc + (r.status === "LUNAS" ? 0 : r.retention_amount || 0),
      0
    );
  }, [displayRetentions]);

  // Handlers for Contracts & Claims
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("create-contract");
      let projId = newContractForm.project_id || currentProject?.id || "";
      if (projId.startsWith("sample-")) {
        alert("Pilih proyek aktif perusahaan (bukan template sampel) untuk menyimpan kontrak ke database.");
        return;
      }
      if (!newContractForm.labor_rate_id) throw new Error("Pilih item dari Database Harga Upah.");

      await createProjectLaborItem({
        project_id: projId,
        mandor_name: newContractForm.mandor_name || primaryMandor,
        labor_rate_id: newContractForm.labor_rate_id,
        contract_volume: Number(newContractForm.contract_volume),
        notes: newContractForm.notes,
      });

      setSuccessMsg("Pekerjaan borongan baru berhasil ditambahkan.");
      setShowAddContractModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal membuat pekerjaan borongan.");
    } finally {
      setPendingAction(null);
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
    if (!selectedContract || pendingAction) return;
    try {
      setPendingAction("submit-claim");
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
    } finally {
      setPendingAction(null);
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
    if (!selectedClaim || pendingAction) return;
    try {
      setPendingAction("verify-claim");
      await verifyLaborClaim(selectedClaim.id, Number(verifyForm.verified_volume), verifyForm.supervisor_notes);
      setSuccessMsg("Volume klaim upah berhasil diverifikasi oleh pengawas.");
      setShowVerifyModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memverifikasi klaim upah.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleApprove = async (claim: LaborClaimItem) => {
    if (pendingAction) return;
    try {
      setPendingAction(`approve-${claim.id}`);
      const volToApprove = claim.verified_volume > 0 ? claim.verified_volume : claim.claimed_volume;
      await approveLaborClaim(claim.id, volToApprove);
      setSuccessMsg("Klaim upah berhasil disetujui.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyetujui klaim.");
    } finally {
      setPendingAction(null);
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
    if (!selectedClaim || pendingAction) return;
    try {
      setPendingAction("pay-claim");
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
    } finally {
      setPendingAction(null);
    }
  };

  // EXPORT TO EXCEL: Matches Dustin's Format Exactly!
  const handleExportExcel = () => {
    if (!currentProject) return;
    try {
      const wb = XLSX.utils.book_new();
      const projName = currentProject.name;
      const mandor = primaryMandor;
      const shortName = projName.split("-")[0].trim();

      // 1. Sheet Retensi
      const retensiRows: any[][] = [
        [],
        ["", "Rekapitulasi Retensi"],
        ["", "PEKERJAAN RENOVASI"],
        ["", projName],
        ["", mandor],
        ["", "No", "Tanggal", "Total Tagihan Upah", "Yang Sudah Dibayarkan", "RETENSI"],
        ["", "", "", "100%", "90%", "10%"],
      ];

      displayRetentions.forEach((r: any) => {
        retensiRows.push([
          "",
          r.termin_number,
          r.claim_date,
          r.total_claim,
          r.status === "LUNAS" ? "LUNAS" : r.paid_amount,
          r.status === "LUNAS" ? "LUNAS" : r.retention_amount,
        ]);
      });

      retensiRows.push([]);
      retensiRows.push(["", "Total Retensi", "", "", "", totalRetensiTertahan]);

      const wsRetensi = XLSX.utils.aoa_to_sheet(retensiRows);
      XLSX.utils.book_append_sheet(wb, wsRetensi, `Retensi - ${shortName}`);

      // 2. Sheet Upah
      const upahRows: any[][] = [
        [],
        ["", "Rekapitulasi Borongan Proyek"],
        ["", "PEKERJAAN RENOVASI"],
        ["", projName],
        ["", mandor],
        ["", "No", "Item Pekerjaan", "Tanggal", "Volume", "Total", "Satuan", "Harga Satuan", "Jumlah Harga"],
        ["", "", "", "", "", "Volume", "", "(Rp.)", "(Rp.)"],
      ];

      displayItems.forEach((it: any) => {
        const firstProg = it.progress_records && it.progress_records[0];
        upahRows.push([
          "",
          it.item_number,
          it.job_name,
          firstProg ? firstProg.date : "",
          firstProg ? firstProg.volume : it.total_volume,
          it.total_volume,
          it.unit,
          it.unit_rate,
          it.total_amount,
        ]);

        if (it.progress_records && it.progress_records.length > 1) {
          for (let k = 1; k < it.progress_records.length; k++) {
            const p = it.progress_records[k];
            upahRows.push(["", "", "", p.date, p.volume]);
          }
        }
      });

      upahRows.push([]);
      upahRows.push(["", "Total Borongan", "", "", "", "", "", "", totalBoronganAmount]);

      const wsUpah = XLSX.utils.aoa_to_sheet(upahRows);
      XLSX.utils.book_append_sheet(wb, wsUpah, `Upah - ${shortName}`);

      const fileName = `Rekapitulasi_Upah_Material_${projName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setSuccessMsg(`File Excel "${fileName}" berhasil diunduh dengan format standar TTD.`);
    } catch (err: any) {
      console.error("Gagal export excel:", err);
      setError("Gagal mengekspor file Excel: " + err.message);
    }
  };

  // IMPORT FROM EXCEL: Reads uploaded spreadsheet & saves to DB
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isImporting) return;

    try {
      setIsImporting(true);
      setIsLoading(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });

      let importedProjectsCount = 0;

      // Scan all sheet pairs (Upah & Retensi)
      const upahSheets = wb.SheetNames.filter((n) => n.toLowerCase().includes("upah"));

      for (const upahSheetName of upahSheets) {
        const projKey = upahSheetName.replace(/upah\s*-\s*/i, "").trim();
        const retensiSheetName = wb.SheetNames.find(
          (n) => n.toLowerCase().includes("retensi") && n.toLowerCase().includes(projKey.toLowerCase())
        );

        const upahSheet = wb.Sheets[upahSheetName];
        const upahRows = XLSX.utils.sheet_to_json(upahSheet, { header: 1 }) as any[][];

        const projName = upahRows[3] ? upahRows[3][1] || projKey : projKey;
        const mandorName = upahRows[4] ? upahRows[4][1] || "Rian Purnama" : "Rian Purnama";

        // Parse items
        const items: any[] = [];
        let currentItem: any = null;

        for (let r = 7; r < upahRows.length; r++) {
          const row = upahRows[r];
          if (!row || row.length === 0) continue;
          const noVal = row[0];
          const jobNameVal = row[1];
          const dateVal = row[2];
          const volVal = row[3];
          const totalVolVal = row[4];
          const unitVal = row[5];
          const rateVal = row[6];
          const totalAmountVal = row[7];

          if (noVal !== undefined && jobNameVal) {
            if (typeof noVal === "string" && noVal.toLowerCase().includes("total")) continue;
            currentItem = {
              item_number: String(noVal).trim(),
              job_name: String(jobNameVal).trim(),
              unit: unitVal ? String(unitVal).trim() : "m²",
              unit_rate: Number(rateVal) || 0,
              total_volume: Number(totalVolVal) || 0,
              total_amount: Number(totalAmountVal) || 0,
              progress_records: [],
            };
            if (dateVal && volVal !== undefined) {
              currentItem.progress_records.push({
                date: typeof dateVal === "number" ? XLSX.SSF.format("YYYY-MM-DD", dateVal) : String(dateVal),
                volume: Number(volVal) || 0,
              });
            }
            items.push(currentItem);
          } else if (currentItem && dateVal && volVal !== undefined) {
            currentItem.progress_records.push({
              date: typeof dateVal === "number" ? XLSX.SSF.format("YYYY-MM-DD", dateVal) : String(dateVal),
              volume: Number(volVal) || 0,
            });
          }
        }

        // Parse retentions
        const retentionsList: any[] = [];
        if (retensiSheetName) {
          const retensiSheet = wb.Sheets[retensiSheetName];
          const retensiRows = XLSX.utils.sheet_to_json(retensiSheet, { header: 1 }) as any[][];

          for (let r = 7; r < retensiRows.length; r++) {
            const row = retensiRows[r];
            if (!row || row.length === 0) continue;
            const noVal = row[0];
            const dateVal = row[1];
            const claimVal = row[2];
            const paidVal = row[3];
            const retVal = row[4];

            if (typeof noVal === "string" && noVal.toLowerCase().includes("total")) continue;
            if (noVal !== undefined && dateVal) {
              const isLunas = typeof retVal === "string" && retVal.toUpperCase().includes("LUNAS");
              const claimNum = Number(claimVal) || 0;
              const paidNum = isLunas ? claimNum : Number(paidVal) || Math.round(claimNum * 0.9);
              const retNum = isLunas ? 0 : Number(retVal) || claimNum - paidNum;

              retentionsList.push({
                termin_number: Number(noVal) || retentionsList.length + 1,
                date: typeof dateVal === "number" ? XLSX.SSF.format("YYYY-MM-DD", dateVal) : String(dateVal),
                total_claim: claimNum,
                paid_amount: paidNum,
                retention_amount: retNum,
                status: isLunas ? "LUNAS" : "HELD",
              });
            }
          }
        }

        // Save batch to database via server action
        await importProjectLaborRecapBatch({
          project_name: projName,
          mandor_name: mandorName,
          items,
          retentions: retentionsList,
        });

        importedProjectsCount++;
      }

      setSuccessMsg(`Berhasil mengimpor ${importedProjectsCount} proyek borongan dari file Excel!`);
      setShowImportExcelModal(false);
      fetchData();
    } catch (err: any) {
      console.error("Gagal impor Excel:", err);
      setError("Gagal mengimpor file Excel: " + err.message);
    } finally {
      setIsImporting(false);
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <HardHat className="h-3.5 w-3.5" />
            Rekapitulasi Borongan & Retensi Proyek
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            {currentProject ? currentProject.name : "Rekapitulasi Upah Proyek"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Mandor Utama: <span className="font-semibold text-zinc-800">{primaryMandor}</span> • Klasifikasi:{" "}
            <span className="font-semibold text-zinc-800">PEKERJAAN RENOVASI</span>
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white pl-3 pr-8 py-2 text-xs font-semibold text-zinc-800 outline-none cursor-pointer shadow-xs focus:border-zinc-400"
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-xs"
            title="Download file Excel persis format TTD"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            Export Excel TTD
          </button>

          <button
            onClick={() => setShowImportExcelModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 text-blue-700" />
            Import Excel
          </button>

          <button
            onClick={() => {
              const laborRate =
                boronganLaborRates.find((rate) => rate.id === newContractForm.labor_rate_id) ||
                boronganLaborRates[0];
              const mandorName = primaryMandor;
              setNewContractForm({
                ...newContractForm,
                project_id: currentProject?.id || "",
                mandor_name: mandorName,
                labor_rate_id: laborRate?.id || "",
                job_name: laborRate?.job_name || "",
                category: laborRate?.category || "",
                specifications: laborRate?.specifications || "",
                unit: laborRate?.unit || "",
                unit_rate: laborRate
                  ? resolveLaborRatePrice(laborRate, mandorName).unitRate
                  : 0,
              });
              setShowAddContractModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pekerjaan
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

      {/* KPI Cards: Standard TTD Financial Recap */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nilai Borongan"
          value={formatCurrency(totalBoronganAmount)}
          subtitle={`${displayItems.length} item pekerjaan terdaftar`}
          icon={HardHat}
        />
        <StatCard
          title="Total Tagihan Upah (100%)"
          value={formatCurrency(totalTagihanUpah)}
          subtitle={`${displayRetentions.length} termin pengajuan opname`}
          icon={FileText}
        />
        <StatCard
          title="Sudah Dibayarkan (90%)"
          value={formatCurrency(totalSudahDibayar)}
          subtitle="90% pencairan termin ke mandor"
          icon={CheckCircle2}
        />
        <StatCard
          title="Total Retensi Tertahan (10%)"
          value={formatCurrency(totalRetensiTertahan)}
          subtitle="Jaminan pemeliharaan 10%"
          icon={DollarSign}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("BORONGAN")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "BORONGAN"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            📋 Rekapitulasi Borongan (Sheet Upah)
          </button>
          <button
            onClick={() => setActiveTab("RETENSI")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "RETENSI"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            🛡️ Rekapitulasi Retensi (Sheet Retensi)
          </button>
          <button
            onClick={() => setActiveTab("CONTRACTS")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "CONTRACTS"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Daftar Kontrak & Volume
          </button>
          <button
            onClick={() => setActiveTab("CLAIMS")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "CLAIMS"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Pengajuan Klaim & Approval ({claims.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari item pekerjaan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: REKAPITULASI BORONGAN (FORMAT PERSIS SHEET UPAH EXCEL) */}
      {/* ============================================================ */}
      {activeTab === "BORONGAN" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Rekapitulasi Borongan Proyek</h2>
              <p className="text-xs text-zinc-500">
                Format standar TimeTravelDesign: Volume parsial per tanggal opname, akumulasi volume total, dan jumlah harga borongan.
              </p>
            </div>
            <div className="text-xs font-semibold text-zinc-700 bg-white px-3 py-1.5 rounded-xl border border-zinc-200">
              Total: <span className="font-bold text-zinc-950">{formatCurrency(totalBoronganAmount)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600 border-collapse">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">No</th>
                  <th className="px-4 py-3 min-w-[260px]">Item Pekerjaan</th>
                  <th className="px-4 py-3 min-w-[220px]">Riwayat Opname & Tanggal</th>
                  <th className="px-3 py-3 text-right font-bold text-zinc-950">Total Vol</th>
                  <th className="px-3 py-3 text-center">Satuan</th>
                  <th className="px-4 py-3 text-right">Harga Satuan (Rp.)</th>
                  <th className="px-4 py-3 text-right font-bold text-zinc-950">Jumlah Harga (Rp.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDisplayItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400">
                      Tidak ada data pekerjaan borongan yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredDisplayItems.map((item: any, idx: number) => {
                    const hasProgress = item.progress_records && item.progress_records.length > 0;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-3 py-3 text-center font-mono text-zinc-400 font-semibold">
                          {item.item_number || idx + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-950">
                          {item.job_name}
                        </td>

                        {/* Riwayat Opname & Tanggal */}
                        <td className="px-4 py-3">
                          {hasProgress ? (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {item.progress_records.map((prog: any, pIdx: number) => (
                                <span
                                  key={pIdx}
                                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-800"
                                >
                                  <Calendar className="h-2.5 w-2.5 text-zinc-500" />
                                  <span className="font-semibold text-zinc-900">{prog.date}</span>:{" "}
                                  <span className="font-bold text-blue-700">{prog.volume}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Satu tahap awal</span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-zinc-900 font-mono">
                          {item.total_volume}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {formatCurrency(item.unit_rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-950">
                          {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-bold text-xs text-zinc-950">
                <tr>
                  <td colSpan={6} className="px-4 py-3.5 text-right font-bold uppercase tracking-wider">
                    Total Borongan:
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold text-emerald-900">
                    {formatCurrency(totalBoronganAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: REKAPITULASI RETENSI (FORMAT PERSIS SHEET RETENSI EXCEL) */}
      {/* ============================================================ */}
      {activeTab === "RETENSI" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Rekapitulasi Retensi & Termin</h2>
              <p className="text-xs text-zinc-500">
                Pencatatan tagihan mingguan (100%), pencairan termin (90%), dan jaminan retensi (10%) per proyek.
              </p>
            </div>
            <div className="text-xs font-semibold text-zinc-700 bg-white px-3 py-1.5 rounded-xl border border-zinc-200">
              Total Retensi: <span className="font-bold text-emerald-800">{formatCurrency(totalRetensiTertahan)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 text-center w-16">Termin</th>
                  <th className="px-4 py-3.5">Tanggal</th>
                  <th className="px-4 py-3.5 text-right font-bold text-zinc-950">
                    Total Tagihan Upah <span className="text-[10px] text-zinc-400 font-normal">(100%)</span>
                  </th>
                  <th className="px-4 py-3.5 text-right font-bold text-zinc-950">
                    Yang Sudah Dibayarkan <span className="text-[10px] text-zinc-400 font-normal">(90%)</span>
                  </th>
                  <th className="px-4 py-3.5 text-right font-bold text-emerald-900">
                    RETENSI <span className="text-[10px] text-emerald-600 font-normal">(10%)</span>
                  </th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displayRetentions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      Belum ada catatan termin retensi pada proyek ini.
                    </td>
                  </tr>
                ) : (
                  displayRetentions.map((ret: any) => {
                    const isLunas = ret.status === "LUNAS";
                    return (
                      <tr key={ret.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-4 py-3 text-center font-bold text-zinc-700">
                          {ret.termin_number}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-950">
                          {ret.claim_date}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-950">
                          {formatCurrency(ret.total_claim)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {isLunas ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              LUNAS
                            </span>
                          ) : (
                            <span className="text-zinc-800">{formatCurrency(ret.paid_amount)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-800">
                          {isLunas ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              LUNAS
                            </span>
                          ) : (
                            formatCurrency(ret.retention_amount)
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={isLunas ? "success" : "warning"}>
                            {isLunas ? "Lunas" : "Tertahan"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-bold text-xs text-zinc-950">
                <tr>
                  <td colSpan={2} className="px-4 py-3.5 text-right font-bold uppercase tracking-wider">
                    Total:
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-zinc-950">
                    {formatCurrency(totalTagihanUpah)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-zinc-900">
                    {formatCurrency(totalSudahDibayar)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold text-emerald-900">
                    {formatCurrency(totalRetensiTertahan)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: CONTRACTS & VOLUME TRACKING (OPERATIONAL VIEW) */}
      {/* ============================================================ */}
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
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-400">
                      Belum ada paket pekerjaan kontrak tercatat pada proyek ini.
                    </td>
                  </tr>
                ) : (
                  contracts.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{item.job_name}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">
                          {item.project?.name || currentProject?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-800 font-medium">{item.mandor_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{item.payment_system}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.contract_volume} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_rate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">
                        {item.claimed_volume || 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {item.approved_volume || 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.paid_volume ? item.paid_volume.toFixed(2) : 0} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-800">
                        {formatCurrency(item.remaining_amount || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenClaimModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black transition shadow-xs"
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

      {/* ============================================================ */}
      {/* TAB 4: CLAIMS & APPROVAL WORKFLOW */}
      {/* ============================================================ */}
      {activeTab === "CLAIMS" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">No & Tanggal Klaim</th>
                  <th className="px-4 py-3.5">Pekerjaan & Mandor</th>
                  <th className="px-4 py-3.5 text-right">Vol Diajukan</th>
                  <th className="px-4 py-3.5 text-right">Vol Diverifikasi</th>
                  <th className="px-4 py-3.5 text-right">Vol Disetujui</th>
                  <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Nilai Disetujui</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400">
                      Belum ada pengajuan klaim upah.
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-zinc-950">{claim.claim_number}</div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(claim.claim_date).toLocaleDateString("id-ID")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">{claim.work_description || "Pekerjaan Upah"}</div>
                        <div className="text-[10px] text-zinc-500">{claim.mandor_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">
                        {claim.claimed_volume}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">
                        {claim.verified_volume || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-800">
                        {claim.approved_volume || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(claim.approved_amount || claim.claimed_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            claim.status === "PAID"
                              ? "success"
                              : claim.status === "APPROVED"
                              ? "emerald"
                              : claim.status === "VERIFIED"
                              ? "info"
                              : claim.status === "REJECTED"
                              ? "error"
                              : "warning"
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
                              className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              Verifikasi
                            </button>
                          )}
                          {claim.status === "VERIFIED" && (
                            <button
                              onClick={() => handleApprove(claim)}
                              disabled={pendingAction !== null}
                              aria-busy={pendingAction === `approve-${claim.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pendingAction === `approve-${claim.id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                              {pendingAction === `approve-${claim.id}` ? "Menyetujui..." : "Setujui"}
                            </button>
                          )}
                          {claim.status === "APPROVED" && (
                            <button
                              onClick={() => handleOpenPayModal(claim)}
                              className="rounded-lg bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black transition shadow-xs"
                            >
                              Bayar Kas
                            </button>
                          )}
                          {claim.status === "PAID" && (
                            <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Lunas
                            </span>
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

      {/* ============================================================ */}
      {/* MODAL: IMPORT EXCEL REKAPITULASI (DUSTIN'S FORMAT) */}
      {/* ============================================================ */}
      {showImportExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Impor Rekapitulasi dari Excel</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Mendukung file Excel format standar TTD (Sheet Upah & Sheet Retensi per proyek).
                </p>
              </div>
              <button onClick={() => setShowImportExcelModal(false)} disabled={isImporting} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div
                onClick={() => !isImporting && fileInputRef.current?.click()}
                aria-busy={isImporting}
                className={`border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-center transition bg-zinc-50/50 ${isImporting ? "cursor-wait opacity-70" : "cursor-pointer hover:border-zinc-900"}`}
              >
                {isImporting ? (
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-2" />
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                )}
                <p className="text-xs font-bold text-zinc-800">
                  {isImporting ? "Mengimpor file Excel..." : "Klik untuk memilih file Excel (.xlsx)"}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  File seperti <span className="font-mono text-zinc-700">Rekapitulasi Upah Material Proyek.xlsx</span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportExcelFile}
                  disabled={isImporting}
                  className="hidden"
                />
              </div>

              <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3 text-xs text-blue-900">
                <span className="font-bold">Format yang didukung:</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-blue-800">
                  <li>Sheet <span className="font-mono font-semibold">Upah - [Nama Proyek]</span>: Rincian item pekerjaan, tanggal opname, volume parsial, satuan, dan harga.</li>
                  <li>Sheet <span className="font-mono font-semibold">Retensi - [Nama Proyek]</span>: Jadwal termin 100%, pencairan 90%, dan potongan retensi 10%.</li>
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportExcelModal(false)}
                  disabled={isImporting}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TAMBAH PEKERJAAN BORONGAN */}
      {/* ============================================================ */}
      {showAddContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Tambah Paket Pekerjaan Borongan</h3>
              <button onClick={() => setShowAddContractModal(false)} disabled={pendingAction === "create-contract"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Proyek</label>
                <select
                  value={newContractForm.project_id || currentProject?.id || ""}
                  onChange={(e) => setNewContractForm({ ...newContractForm, project_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Nama Mandor / Tukang</label>
                  <input
                    type="text"
                    value={newContractForm.mandor_name}
                    onChange={(e) => {
                      const mandorName = e.target.value;
                      setNewContractForm((prev) => {
                        const rate = boronganLaborRates.find((item) => item.id === prev.labor_rate_id);
                        return {
                          ...prev,
                          mandor_name: mandorName,
                          unit_rate: rate ? resolveLaborRatePrice(rate, mandorName).unitRate : 0,
                        };
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    placeholder="Contoh: Rian Purnama, Rosidin"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kategori Pekerjaan</label>
                  <input
                    type="text"
                    value={newContractForm.category}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Item Pekerjaan dari Database Harga Upah</label>
                <select
                  value={newContractForm.labor_rate_id}
                  onChange={(e) => {
                    const rate = boronganLaborRates.find((item) => item.id === e.target.value);
                    setNewContractForm((prev) => ({
                      ...prev,
                      labor_rate_id: rate?.id || "",
                      job_name: rate?.job_name || "",
                      category: rate?.category || "",
                      specifications: rate?.specifications || "",
                      unit: rate?.unit || "",
                      unit_rate: rate
                        ? resolveLaborRatePrice(rate, prev.mandor_name).unitRate
                        : 0,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs font-semibold text-zinc-900 outline-none focus:border-zinc-400"
                  required
                >
                  <option value="">Pilih item pekerjaan...</option>
                  {boronganLaborRates.map((rate) => {
                    const pricing = resolveLaborRatePrice(rate, newContractForm.mandor_name);
                    return (
                      <option key={rate.id} value={rate.id}>
                        {rate.job_code} • {rate.job_name} ({formatCurrency(pricing.unitRate)} / {rate.unit})
                      </option>
                    );
                  })}
                </select>
                {boronganLaborRates.length === 0 ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Belum ada item Borongan aktif. Tambahkan dulu di{" "}
                    <Link href="/cost-control/labor-rates" className="font-semibold underline">
                      Database Harga Upah
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Nama item, kategori, satuan, dan tarif diambil otomatis dari database.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Volume Total</label>
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
                    readOnly
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">
                    Tarif Satuan (Rp) — {selectedLaborPricing?.source === "MANDOR" ? "tarif mandor" : "tarif standar"}
                  </label>
                  <input
                    type="number"
                    value={newContractForm.unit_rate}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-bold text-zinc-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddContractModal(false)}
                  disabled={pendingAction === "create-contract"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  aria-busy={pendingAction === "create-contract"}
                  disabled={pendingAction !== null || !selectedLaborRate || newContractForm.unit_rate <= 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingAction === "create-contract" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "create-contract" ? "Menyimpan Pekerjaan..." : "Simpan Pekerjaan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: VERIFIKASI VOLUME LAPANGAN OLEH PENGAWAS */}
      {/* ============================================================ */}
      {showVerifyModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">Verifikasi Pengawas Lapangan</h3>
              <button onClick={() => setShowVerifyModal(false)} disabled={pendingAction === "verify-claim"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyClaim} className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-zinc-500">Volume Diklaim Mandor:</span>
                <div className="text-sm font-bold text-blue-700">{selectedClaim.claimed_volume}</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">
                  Volume Hasil Pengukuran Fisik Pengawas
                </label>
                <input
                  type="number"
                  step="any"
                  value={verifyForm.verified_volume}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verified_volume: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Pengawas Lapangan</label>
                <input
                  type="text"
                  value={verifyForm.supervisor_notes}
                  onChange={(e) => setVerifyForm({ ...verifyForm, supervisor_notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  disabled={pendingAction === "verify-claim"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "verify-claim"}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "verify-claim" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "verify-claim" ? "Memverifikasi..." : "Konfirmasi Verifikasi Fisik"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: BAYAR KAS (INTEGRASI FINANCIAL) */}
      {/* ============================================================ */}
      {showPayModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">Pembayaran Kas Upah Mandor</h3>
              <button onClick={() => setShowPayModal(false)} disabled={pendingAction === "pay-claim"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePayClaim} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Akun Kas / Bank Sumber Dana</label>
                <select
                  value={payForm.cash_account_id}
                  onChange={(e) => setPayForm({ ...payForm, cash_account_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Jumlah Yang Dibayarkan (Rp)</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Pengeluaran</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Transaksi ini otomatis dicatat ke tabel pengeluaran kas under kategori{" "}
                <span className="font-bold">Upah Tukang</span>.
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  disabled={pendingAction === "pay-claim"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "pay-claim"}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "pay-claim" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "pay-claim" ? "Memproses Pembayaran..." : "Proses Pembayaran Kas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
