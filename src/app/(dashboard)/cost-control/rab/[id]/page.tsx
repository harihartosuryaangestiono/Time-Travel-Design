"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Calculator,
  ArrowLeft,
  Plus,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  Layers,
  Trash2,
  Edit2,
  Sliders,
  DollarSign,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getRabProjectDetail,
  getMasterAhspList,
  addAhspItemToRab,
  addCustomRabItem,
  deleteRabItem,
  recalculateRab,
  approveRabProject,
  createNewRabVersion,
  getRabOrganizationProfile,
  RabProjectItem,
  MasterAhspItem,
  RabOrganizationProfile,
} from "@/app/actions/cost-control/rabActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { normalizeAhspCategory } from "@/lib/cost-control/ahspCategories";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function RabDetailWorksheetPage() {
  const params = useParams();
  const router = useRouter();
  const rabId = params.id as string;

  const [rab, setRab] = useState<RabProjectItem | null>(null);
  const [ahspCatalog, setAhspCatalog] = useState<MasterAhspItem[]>([]);
  const [organizationProfile, setOrganizationProfile] = useState<RabOrganizationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<
    "add-ahsp" | "add-custom" | "delete-item" | "save-margin" | "approve" | "revision" | null
  >(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded components view
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Modals
  const [showAhspPickerModal, setShowAhspPickerModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);

  // Forms
  const [ahspPickForm, setAhspPickForm] = useState({
    ahsp_id: "",
    category: "Pekerjaan Arsitektural",
    division: "III. PEKERJAAN ARSITEKTUR & FINISHING",
    sub_division: "Lantai & Dinding",
    volume: 100,
  });

  const [customItemForm, setCustomItemForm] = useState({
    division: "I. PEKERJAAN PERSIAPAN",
    sub_division: "",
    item_code: "",
    item_name: "",
    unit: "ls",
    volume: 1,
    material_unit_cost: 0,
    labor_unit_cost: 0,
    equipment_unit_cost: 0,
  });

  const [marginForm, setMarginForm] = useState({
    profit_type: "MARKUP" as "MARKUP" | "GROSS_MARGIN",
    profit_percentage: 20,
    overhead_percentage: 5,
    contingency_percentage: 0,
    tax_percentage: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [detail, ahspList, orgProfile] = await Promise.all([
        getRabProjectDetail(rabId),
        getMasterAhspList(),
        getRabOrganizationProfile(),
      ]);
      setRab(detail);
      setAhspCatalog(ahspList);
      setOrganizationProfile(orgProfile);
      if (ahspList.length > 0) {
        setAhspPickForm((prev) => {
          const currentItem = ahspList.find((item) => item.id === prev.ahsp_id);
          const category = currentItem
            ? normalizeAhspCategory(currentItem.category)
            : ahspList.some((item) => normalizeAhspCategory(item.category) === prev.category)
              ? prev.category
              : normalizeAhspCategory(ahspList[0].category);
          const selectedItem = currentItem && normalizeAhspCategory(currentItem.category) === category
            ? currentItem
            : ahspList.find((item) => normalizeAhspCategory(item.category) === category);

          return {
            ...prev,
            category,
            ahsp_id: selectedItem?.id ?? "",
          };
        });
      }
      setMarginForm({
        profit_type: detail.profit_type,
        profit_percentage: detail.profit_percentage,
        overhead_percentage: detail.overhead_percentage,
        contingency_percentage: detail.contingency_percentage,
        tax_percentage: detail.tax_percentage,
      });
    } catch (err: any) {
      console.error("Gagal memuat detail RAB:", err);
      setError(err?.message || "Gagal memuat worksheet RAB.");
    } finally {
      setIsLoading(false);
    }
  }, [rabId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group items by division
  const divisionGroups = useMemo(() => {
    if (!rab || !rab.items) return [];
    const map = new Map<string, typeof rab.items>();
    rab.items.forEach((it) => {
      const list = map.get(it.division) || [];
      list.push(it);
      map.set(it.division, list);
    });

    return Array.from(map.entries()).map(([division, items]) => {
      const subtotalHpp = items.reduce((sum, it) => sum + it.total_hpp, 0);
      const subtotalSelling = items.reduce((sum, it) => sum + it.total_price, 0);
      return { division, items, subtotalHpp, subtotalSelling };
    });
  }, [rab]);

  const printableDivisionGroups = useMemo(() => {
    let itemIndex = 1;
    return divisionGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        printIndex: itemIndex++,
      })),
    }));
  }, [divisionGroups]);

  const ahspCategories = useMemo(
    () => Array.from(new Set(ahspCatalog.map((item) => normalizeAhspCategory(item.category))))
      .sort((a, b) => a.localeCompare(b, "id")),
    [ahspCatalog],
  );
  const filteredAhspCatalog = useMemo(
    () => ahspCatalog.filter((item) => normalizeAhspCategory(item.category) === ahspPickForm.category),
    [ahspCatalog, ahspPickForm.category],
  );

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAddAhsp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!ahspPickForm.ahsp_id) throw new Error("Pilih item AHSP.");
      setPendingAction("add-ahsp");
      setError(null);
      await addAhspItemToRab({
        rab_id: rabId,
        ahsp_id: ahspPickForm.ahsp_id,
        division: ahspPickForm.division,
        sub_division: ahspPickForm.sub_division,
        volume: Number(ahspPickForm.volume),
      });
      await fetchData();
      setSuccessMsg("Pekerjaan dari AHSP berhasil ditambahkan ke RAB.");
      setShowAhspPickerModal(false);
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan AHSP.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!customItemForm.item_name.trim()) throw new Error("Nama item pekerjaan wajib diisi.");
      setPendingAction("add-custom");
      setError(null);
      await addCustomRabItem({
        rab_id: rabId,
        division: customItemForm.division,
        sub_division: customItemForm.sub_division,
        item_code: customItemForm.item_code,
        item_name: customItemForm.item_name,
        unit: customItemForm.unit,
        volume: Number(customItemForm.volume),
        material_unit_cost: Number(customItemForm.material_unit_cost),
        labor_unit_cost: Number(customItemForm.labor_unit_cost),
        equipment_unit_cost: Number(customItemForm.equipment_unit_cost),
      });
      await fetchData();
      setSuccessMsg("Item kustom berhasil ditambahkan ke RAB.");
      setShowCustomItemModal(false);
    } catch (err: any) {
      setError(err?.message || "Gagal menambahkan item kustom.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (rab?.is_locked) {
      alert("RAB yang telah disetujui (terkunci) tidak dapat diubah.");
      return;
    }
    if (!confirm("Hapus item pekerjaan ini dari RAB?")) return;
    try {
      setPendingAction("delete-item");
      setDeletingItemId(itemId);
      setError(null);
      await deleteRabItem(itemId, rabId);
      setSuccessMsg("Item pekerjaan berhasil dihapus.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus item.");
    } finally {
      setPendingAction(null);
      setDeletingItemId(null);
    }
  };

  const handleSaveMargin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPendingAction("save-margin");
      setError(null);
      await recalculateRab(rabId, marginForm);
      await fetchData();
      setSuccessMsg("Pengaturan margin dan keuntungan Owner berhasil diperbarui.");
      setShowMarginModal(false);
    } catch (err: any) {
      setError(err?.message || "Gagal memperbarui margin.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Setujui dan kunci RAB ini? Setelah disetujui, harga akan dibekukan sebagai acuan kontrak klien dan RAP.")) return;
    try {
      setPendingAction("approve");
      setError(null);
      await approveRabProject(rabId);
      setSuccessMsg("RAB berhasil disetujui dan versi telah terkunci aman.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyetujui RAB.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreateRevision = async () => {
    if (!confirm("Buat revisi baru (versi berikutnya) dari RAB ini?")) return;
    try {
      setPendingAction("revision");
      setError(null);
      const newVer = await createNewRabVersion(rabId);
      router.push(`/cost-control/rab/${newVer.id}`);
    } catch (err: any) {
      setError(err?.message || "Gagal membuat revisi.");
      setPendingAction(null);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (!rab || !organizationProfile) return;

    const rows: (string | number)[][] = [];
    const mergedRows: number[] = [];
    const addMergedRow = (text: string) => {
      mergedRows.push(rows.length);
      rows.push([text]);
    };

    addMergedRow(organizationProfile.name.toUpperCase());
    addMergedRow([organizationProfile.address, organizationProfile.phone, organizationProfile.email].filter(Boolean).join(" • "));
    rows.push([]);
    addMergedRow("RENCANA ANGGARAN BIAYA (RAB)");
    addMergedRow(rab.title);
    addMergedRow(`Proyek: ${rab.project?.name || "-"} • Lokasi: ${rab.project_location || rab.project?.location || "-"}`);
    addMergedRow(`Nomor: ${rab.rab_number} • Versi: ${rab.version} • Tanggal: ${new Date(rab.date).toLocaleDateString("id-ID")}`);
    addMergedRow(`Klien: ${rab.client_name || "-"}`);
    rows.push([]);
    rows.push([
      "No",
      "Uraian Pekerjaan",
      "Satuan",
      "Volume",
      "Harga Satuan (Rp)",
      "Jumlah Harga (Rp)",
    ]);

    let globalIndex = 1;
    divisionGroups.forEach((group) => {
      rows.push([group.division]);
      mergedRows.push(rows.length - 1);
      group.items.forEach((it) => {
        rows.push([
          globalIndex++,
          it.item_name,
          it.unit,
          it.volume,
          it.unit_hpp,
          it.total_hpp,
        ]);
      });
      rows.push(["", "", "", "", `Subtotal ${group.division}`, group.subtotalHpp]);
      rows.push([]);
    });

    rows.push(["", "", "", "", "Total Semua Pekerjaan", rab.total_hpp]);
    rows.push(["", "", "", "", `Overhead (${rab.overhead_percentage}%)`, rab.overhead_amount]);
    rows.push(["", "", "", "", `Kontingensi (${rab.contingency_percentage}%)`, rab.contingency_amount]);
    rows.push(["", "", "", "", `Keuntungan Owner (${rab.profit_type === "MARKUP" ? "Markup" : "Gross Margin"} ${rab.profit_percentage}%)`, rab.profit_amount]);
    rows.push(["", "", "", "", `PPN (${rab.tax_percentage}%)`, rab.tax_amount]);
    rows.push(["", "", "", "", "GRAND TOTAL HARGA PENAWARAN", rab.grand_total]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!merges"] = mergedRows.map((row) => ({
      s: { r: row, c: 0 },
      e: { r: row, c: 5 },
    }));
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 54 },
      { wch: 12 },
      { wch: 13 },
      { wch: 22 },
      { wch: 24 },
    ];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = 2; column <= 5; column += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell && typeof cell.v === "number") {
          cell.z = column === 2 ? "#,##0.00" : '"Rp" #,##0.00';
        }
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Worksheet RAB");
    XLSX.writeFile(workbook, `${rab.rab_number}_V${rab.version}.xlsx`);
  };

  const handleExportPdf = () => {
    if (!rab || !organizationProfile) return;
    const previousTitle = document.title;
    document.title = `${rab.rab_number}_V${rab.version}`;
    window.addEventListener("afterprint", () => {
      document.title = previousTitle;
    }, { once: true });
    window.print();
  };

  if (!rab && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat worksheet RAB...
        </span>
      </div>
    );
  }

  if (!rab && !isLoading) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500">Dokumen RAB tidak ditemukan.</p>
        <Link href="/cost-control/rab" className="mt-4 inline-flex items-center text-xs font-semibold text-zinc-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Daftar RAB
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          #rab-print-document,
          #rab-print-document * {
            visibility: visible !important;
          }

          #rab-print-document {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 100%;
            color: #111;
            background: #fff;
            font-family: Arial, sans-serif;
            font-size: 9px;
          }

          #rab-print-document .rab-print-header {
            display: flex;
            align-items: center;
            gap: 14px;
            border-bottom: 2px solid #111;
            padding-bottom: 8px;
          }

          #rab-print-document .rab-print-logo {
            max-width: 64px;
            max-height: 54px;
            object-fit: contain;
          }

          #rab-print-document .rab-print-company {
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
          }

          #rab-print-document .rab-print-title {
            margin-top: 12px;
            text-align: center;
            font-size: 14px;
            font-weight: 700;
          }

          #rab-print-document .rab-print-subtitle {
            margin-top: 3px;
            text-align: center;
            font-size: 11px;
            font-weight: 700;
          }

          #rab-print-document .rab-print-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3px 16px;
            margin: 12px 0 8px;
          }

          #rab-print-document table {
            width: 100%;
            border-collapse: collapse;
          }

          #rab-print-document th,
          #rab-print-document td {
            border: 1px solid #333;
            padding: 4px 5px;
          }

          #rab-print-document thead {
            display: table-header-group;
          }

          #rab-print-document tr {
            break-inside: avoid;
          }

          #rab-print-document .rab-print-category {
            background: #e5e7eb;
            font-weight: 700;
          }

          #rab-print-document .rab-print-subtotal td {
            font-weight: 700;
          }

          #rab-print-document .rab-print-number {
            text-align: right;
            white-space: nowrap;
          }

          #rab-print-document .rab-print-summary {
            width: 58%;
            margin: 10px 0 0 auto;
          }

          #rab-print-document .rab-print-grand-total td {
            border-top: 2px solid #111;
            font-weight: 700;
            font-size: 11px;
          }
        }
      `}</style>

      <div id="rab-print-document" className="hidden">
        {rab && organizationProfile && (
          <>
            <header className="rab-print-header">
              {organizationProfile.logo_url && (
                <Image
                  src={organizationProfile.logo_url}
                  alt={`Logo ${organizationProfile.name}`}
                  width={64}
                  height={54}
                  unoptimized
                  className="rab-print-logo"
                />
              )}
              <div>
                <div className="rab-print-company">{organizationProfile.name}</div>
                {organizationProfile.address && <div>{organizationProfile.address}</div>}
                <div>
                  {[organizationProfile.phone, organizationProfile.email].filter(Boolean).join(" • ")}
                </div>
              </div>
            </header>

            <div className="rab-print-title">RENCANA ANGGARAN BIAYA (RAB)</div>
            <div className="rab-print-subtitle">{rab.title}</div>
            <div className="rab-print-meta">
              <div><strong>Proyek:</strong> {rab.project?.name || "-"}</div>
              <div><strong>Nomor RAB:</strong> {rab.rab_number} (Versi {rab.version})</div>
              <div><strong>Klien:</strong> {rab.client_name || "-"}</div>
              <div><strong>Tanggal:</strong> {new Date(rab.date).toLocaleDateString("id-ID")}</div>
              <div><strong>Lokasi:</strong> {rab.project_location || rab.project?.location || "-"}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Uraian Pekerjaan</th>
                  <th>Volume</th>
                  <th>Satuan</th>
                  <th>Harga Satuan (Rp)</th>
                  <th>Jumlah Harga (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {divisionGroups.length === 0 && (
                  <tr>
                    <td colSpan={6}>Belum ada item pekerjaan pada RAB ini.</td>
                  </tr>
                )}
                {printableDivisionGroups.map((group, groupIndex) => (
                  <Fragment key={group.division}>
                    <tr key={`division-${group.division}`} className="rab-print-category">
                      <td colSpan={6}>{String.fromCharCode(65 + groupIndex)}. {group.division}</td>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.printIndex}</td>
                        <td>{item.item_name}</td>
                        <td className="rab-print-number">{item.volume}</td>
                        <td>{item.unit}</td>
                        <td className="rab-print-number">{formatCurrency(item.unit_hpp)}</td>
                        <td className="rab-print-number">{formatCurrency(item.total_hpp)}</td>
                      </tr>
                    ))}
                    <tr key={`subtotal-${group.division}`} className="rab-print-subtotal">
                      <td colSpan={5}>Total {group.division}</td>
                      <td className="rab-print-number">{formatCurrency(group.subtotalHpp)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>

            <table className="rab-print-summary">
              <tbody>
                <tr><td>Total Semua Pekerjaan</td><td className="rab-print-number">{formatCurrency(rab.total_hpp)}</td></tr>
                <tr><td>Overhead ({rab.overhead_percentage}%)</td><td className="rab-print-number">{formatCurrency(rab.overhead_amount)}</td></tr>
                <tr><td>Kontingensi ({rab.contingency_percentage}%)</td><td className="rab-print-number">{formatCurrency(rab.contingency_amount)}</td></tr>
                <tr>
                  <td>Keuntungan Owner ({rab.profit_type === "MARKUP" ? "Markup" : "Gross Margin"} {rab.profit_percentage}%)</td>
                  <td className="rab-print-number">{formatCurrency(rab.profit_amount)}</td>
                </tr>
                <tr><td>PPN ({rab.tax_percentage}%)</td><td className="rab-print-number">{formatCurrency(rab.tax_amount)}</td></tr>
                <tr className="rab-print-grand-total"><td>GRAND TOTAL HARGA PENAWARAN</td><td className="rab-print-number">{formatCurrency(rab.grand_total)}</td></tr>
              </tbody>
            </table>

            {rab.notes && <p><strong>Catatan:</strong> {rab.notes}</p>}
          </>
        )}
      </div>

      {/* Top Navigation & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/cost-control/rab"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-500">{rab?.rab_number}</span>
              <Badge variant={rab?.status === "APPROVED" ? "success" : "neutral"}>
                {rab?.status}
              </Badge>
              {rab?.is_locked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                  <Lock className="h-3 w-3" /> Terkunci (V{rab.version})
                </span>
              )}
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
              {rab?.title}
            </h1>
            <p className="text-xs text-zinc-500">
              Proyek: {rab?.project?.name} ({rab?.project?.code}) • Klien: {rab?.client_name || "-"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={!organizationProfile}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            Export Excel
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!organizationProfile}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            Export PDF
          </button>

          {!rab?.is_locked ? (
            <>
              <button
                onClick={() => setShowMarginModal(true)}
                disabled={pendingAction !== null}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
              >
                <Sliders className="h-3.5 w-3.5 text-zinc-500" />
                Atur Margin Owner
              </button>
              <button
                onClick={handleApprove}
                disabled={pendingAction !== null}
                aria-busy={pendingAction === "approve"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pendingAction === "approve" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyetujui...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui & Kunci RAB
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleCreateRevision}
              disabled={pendingAction !== null}
              aria-busy={pendingAction === "revision"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pendingAction === "revision" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Membuat Revisi...
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Buat Revisi (V{(rab?.version || 1) + 1})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Modal HPP Konstruksi"
          value={formatCurrency(rab?.total_hpp || 0)}
          subtitle="Akumulasi material, upah & alat"
          icon={Calculator}
        />
        <StatCard
          title={`Keuntungan Owner (${rab?.profit_type === "MARKUP" ? "Markup" : "Margin"} ${rab?.profit_percentage}%)`}
          value={formatCurrency(rab?.profit_amount || 0)}
          subtitle={rab?.profit_type === "MARKUP" ? "Dihitung dari modal HPP" : "Dihitung dari harga jual"}
          icon={DollarSign}
        />
        <StatCard
          title="Overhead & Kontingensi"
          value={formatCurrency((rab?.overhead_amount || 0) + (rab?.contingency_amount || 0))}
          subtitle={`${rab?.overhead_percentage}% overhead + ${rab?.contingency_percentage}% kontingensi`}
          icon={Sliders}
        />
        <StatCard
          title="Harga Penawaran Klien (Grand Total)"
          value={formatCurrency(rab?.grand_total || 0)}
          subtitle="Total penawaran kontrak resmi"
          icon={CheckCircle2}
        />
      </div>

      {/* Action Toolbar for Adding Work Items */}
      {!rab?.is_locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xs font-bold text-zinc-950">Tambah Uraian Pekerjaan ke Worksheet</h2>
            <p className="text-[11px] text-zinc-500">Pilih dari katalog standar AHSP otomatis atau input manual</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAhspPickerModal(true)}
              disabled={pendingAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-black transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah dari Katalog AHSP
            </button>
            <button
              onClick={() => setShowCustomItemModal(true)}
              disabled={pendingAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Item Pekerjaan Kustom
            </button>
          </div>
        </div>
      )}

      {/* Main Worksheet Table: Grouped by Division */}
      <div className="space-y-6">
        {divisionGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <Calculator className="mx-auto h-8 w-8 text-zinc-400" />
            <h3 className="mt-3 text-sm font-bold text-zinc-900">Worksheet RAB Masih Kosong</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Mulai menyusun anggaran dengan menambahkan item pekerjaan dari katalog AHSP.
            </p>
            {!rab?.is_locked && (
              <button
                onClick={() => setShowAhspPickerModal(true)}
                disabled={pendingAction !== null}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                <Plus className="h-4 w-4" /> Tambah Item AHSP
              </button>
            )}
          </div>
        ) : (
          divisionGroups.map((group, gIdx) => (
            <div key={group.division} className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
              {/* Division Header */}
              <div className="bg-zinc-50/80 px-4 py-3 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="font-bold text-xs text-zinc-950 uppercase tracking-wide">
                  {group.division}
                </span>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-zinc-500">
                    Subtotal HPP: <strong className="text-zinc-900">{formatCurrency(group.subtotalHpp)}</strong>
                  </span>
                  <span className="text-zinc-500">
                    Subtotal Penawaran: <strong className="text-emerald-800">{formatCurrency(group.subtotalSelling)}</strong>
                  </span>
                </div>
              </div>

              {/* Items in Division */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="border-b border-zinc-100 bg-white text-[11px] font-bold text-zinc-400 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 w-10 text-center">#</th>
                      <th className="px-4 py-2.5">Uraian Pekerjaan & Analisis AHSP</th>
                      <th className="px-4 py-2.5 text-right">Volume</th>
                      <th className="px-4 py-2.5">Satuan</th>
                      <th className="px-4 py-2.5 text-right font-medium text-zinc-700">HPP Satuan</th>
                      <th className="px-4 py-2.5 text-right font-medium text-zinc-700">Total HPP</th>
                      <th className="px-4 py-2.5 text-right font-bold text-zinc-950">Harga Satuan Jual</th>
                      <th className="px-4 py-2.5 text-right font-bold text-zinc-950">Total Penawaran</th>
                      {!rab?.is_locked && <th className="px-4 py-2.5 text-center w-16">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {group.items.map((item, idx) => {
                      const isExpanded = expandedItems[item.id];
                      return (
                        <div key={item.id} className="contents">
                          <tr className="hover:bg-zinc-50/60 transition">
                            <td className="px-4 py-3 text-center text-zinc-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-zinc-950">
                              <div className="flex items-center gap-2">
                                <span>{item.item_name}</span>
                                {item.components && item.components.length > 0 && (
                                  <button
                                    onClick={() => toggleExpand(item.id)}
                                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-800"
                                    title="Tampilkan rincian koefisien AHSP"
                                  >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400">
                                {item.item_code || "-"} {item.sub_division ? `• ${item.sub_division}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-zinc-900">{item.volume}</td>
                            <td className="px-4 py-3 text-zinc-600">{item.unit}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.unit_hpp)}</td>
                            <td className="px-4 py-3 text-right font-medium text-zinc-800">{formatCurrency(item.total_hpp)}</td>
                            <td className="px-4 py-3 text-right font-bold text-zinc-950">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-800">{formatCurrency(item.total_price)}</td>
                            {!rab?.is_locked && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={pendingAction !== null}
                                  aria-label="Hapus item pekerjaan"
                                  className="text-zinc-400 hover:text-red-600 p-1 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {deletingItemId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>

                          {/* Expanded AHSP Component Breakdown */}
                          {isExpanded && item.components && (
                            <tr className="bg-zinc-50/90 text-[11px]">
                              <td colSpan={9} className="px-8 py-3">
                                <div className="space-y-1.5">
                                  <div className="font-bold text-zinc-700">Rincian Komponen Koefisien AHSP:</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                    {item.components.map((c) => (
                                      <div key={c.id} className="rounded-lg border border-zinc-200/80 bg-white p-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-zinc-900">{c.name}</span>
                                          <Badge variant="neutral">{c.component_type}</Badge>
                                        </div>
                                        <div className="mt-1 text-zinc-500">
                                          Koefisien: {c.coefficient} {c.unit} @ {formatCurrency(c.unit_price)}
                                        </div>
                                        <div className="text-right font-bold text-zinc-900 mt-1">
                                          Subtotal: {formatCurrency(c.subtotal)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </div>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Grand Recapitulation Summary Box */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-wide border-b border-zinc-100 pb-3">
          Rekapitulasi Akhir Rencana Anggaran Biaya
        </h2>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between py-1 text-zinc-600">
              <span>HPP Material Bangunan:</span>
              <span className="font-semibold text-zinc-900">{formatCurrency(rab?.total_material_hpp || 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-zinc-600">
              <span>HPP Upah Tenaga Kerja & Borongan:</span>
              <span className="font-semibold text-zinc-900">{formatCurrency(rab?.total_labor_hpp || 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-zinc-600">
              <span>HPP Peralatan & Operasional:</span>
              <span className="font-semibold text-zinc-900">{formatCurrency(rab?.total_equipment_hpp || 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-zinc-200 font-bold text-zinc-950">
              <span>TOTAL BIAYA HPP (MODAL DASAR):</span>
              <span>{formatCurrency(rab?.total_hpp || 0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1 text-zinc-600">
              <span>Keuntungan / Profit Owner ({rab?.profit_type === "MARKUP" ? "Markup" : "Gross Margin"} {rab?.profit_percentage}%):</span>
              <span className="font-semibold text-emerald-800">+{formatCurrency(rab?.profit_amount || 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-zinc-600">
              <span>Biaya Overhead Kantor ({rab?.overhead_percentage}%):</span>
              <span className="font-semibold text-zinc-900">+{formatCurrency(rab?.overhead_amount || 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-zinc-600">
              <span>Pajak Pertambahan Nilai (PPN {rab?.tax_percentage}%):</span>
              <span className="font-semibold text-zinc-900">+{formatCurrency(rab?.tax_amount || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-zinc-200 text-sm font-bold text-zinc-950 bg-zinc-50 px-3 rounded-lg">
              <span>TOTAL HARGA PENAWARAN (GRAND TOTAL):</span>
              <span className="text-emerald-900">{formatCurrency(rab?.grand_total || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: PICK AHSP TEMPLATE */}
      {showAhspPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Pilih dari Master AHSP</h3>
              <button
                type="button"
                onClick={() => setShowAhspPickerModal(false)}
                disabled={pendingAction !== null}
                className="text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAhsp} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Kategori Pekerjaan</label>
                <select
                  value={ahspPickForm.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    const firstItem = ahspCatalog.find((item) => normalizeAhspCategory(item.category) === category);
                    setAhspPickForm((prev) => ({
                      ...prev,
                      category,
                      ahsp_id: firstItem?.id ?? "",
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-semibold outline-none focus:border-zinc-400"
                  required
                >
                  {ahspCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Divisi Pekerjaan</label>
                <input
                  type="text"
                  value={ahspPickForm.division}
                  onChange={(e) => setAhspPickForm({ ...ahspPickForm, division: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-semibold outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Pekerjaan AHSP</label>
                <select
                  value={ahspPickForm.ahsp_id}
                  onChange={(e) => setAhspPickForm({ ...ahspPickForm, ahsp_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {filteredAhspCatalog.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} • {a.name} ({a.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Sub-Divisi / Zona (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Lantai 1"
                    value={ahspPickForm.sub_division}
                    onChange={(e) => setAhspPickForm({ ...ahspPickForm, sub_division: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Volume Pekerjaan</label>
                  <input
                    type="number"
                    step="any"
                    value={ahspPickForm.volume}
                    onChange={(e) => setAhspPickForm({ ...ahspPickForm, volume: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600">
                Sistem otomatis memecah kebutuhan material, upah tukang, dan koefisien standar ke lembar RAB.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAhspPickerModal(false)}
                  disabled={pendingAction !== null}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "add-ahsp"}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingAction === "add-ahsp" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menambahkan...
                    </>
                  ) : "Masukkan ke RAB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOM ITEM PEKERJAAN */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Tambah Item Pekerjaan Kustom</h3>
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                disabled={pendingAction !== null}
                className="text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Divisi</label>
                <input
                  type="text"
                  value={customItemForm.division}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, division: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Uraian Nama Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembersihan Lapangan & Pemasangan Pagar Proyek"
                  value={customItemForm.item_name}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, item_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Volume</label>
                  <input
                    type="number"
                    step="any"
                    value={customItemForm.volume}
                    onChange={(e) => setCustomItemForm({ ...customItemForm, volume: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan</label>
                  <input
                    type="text"
                    value={customItemForm.unit}
                    onChange={(e) => setCustomItemForm({ ...customItemForm, unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">HPP Material (Rp)</label>
                  <input
                    type="number"
                    value={customItemForm.material_unit_cost}
                    onChange={(e) => setCustomItemForm({ ...customItemForm, material_unit_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">HPP Upah (Rp)</label>
                  <input
                    type="number"
                    value={customItemForm.labor_unit_cost}
                    onChange={(e) => setCustomItemForm({ ...customItemForm, labor_unit_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">HPP Alat (Rp)</label>
                  <input
                    type="number"
                    value={customItemForm.equipment_unit_cost}
                    onChange={(e) => setCustomItemForm({ ...customItemForm, equipment_unit_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(false)}
                  disabled={pendingAction !== null}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "add-custom"}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingAction === "add-custom" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : "Simpan Item Kustom"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENGATURAN MARGIN OWNER & SIMULASI */}
      {showMarginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Pengaturan Margin & Simulasi Keuntungan</h3>
                <p className="text-xs text-zinc-500">Konfigurasi persentase profitabilitas dan overhead Owner</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMarginModal(false)}
                disabled={pendingAction !== null}
                className="text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMargin} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Metode Keuntungan</label>
                  <select
                    value={marginForm.profit_type}
                    onChange={(e: any) => setMarginForm({ ...marginForm, profit_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none font-semibold cursor-pointer"
                  >
                    <option value="MARKUP">Markup terhadap Modal (HPP)</option>
                    <option value="GROSS_MARGIN">Gross Margin terhadap Jual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Target Profit (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={marginForm.profit_percentage}
                    onChange={(e) => setMarginForm({ ...marginForm, profit_percentage: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Overhead (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={marginForm.overhead_percentage}
                    onChange={(e) => setMarginForm({ ...marginForm, overhead_percentage: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kontingensi (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={marginForm.contingency_percentage}
                    onChange={(e) => setMarginForm({ ...marginForm, contingency_percentage: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">PPN (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={marginForm.tax_percentage}
                    onChange={(e) => setMarginForm({ ...marginForm, tax_percentage: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none"
                  />
                </div>
              </div>

              {/* Simulation Comparison Banner */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-1.5">
                <div className="font-bold text-zinc-900">Simulasi Matematika Perhitungan:</div>
                <div className="text-zinc-600">
                  {marginForm.profit_type === "MARKUP" ? (
                    <>Rumus Markup: Modal Rp100jt + {marginForm.profit_percentage}% = Rp{(100 * (1 + marginForm.profit_percentage / 100)).toFixed(1)}jt.</>
                  ) : (
                    <>Rumus Gross Margin: Modal Rp100jt ÷ (1 - {marginForm.profit_percentage / 100}) = Rp{(100 / (1 - marginForm.profit_percentage / 100)).toFixed(1)}jt.</>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMarginModal(false)}
                  disabled={pendingAction !== null}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "save-margin"}
                  className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pendingAction === "save-margin" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menghitung ulang...
                    </>
                  ) : "Simpan & Rekalkulasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
