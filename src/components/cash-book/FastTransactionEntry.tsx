"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Send,
  Sparkles,
  Clipboard,
  Calendar,
  Layers,
  Building2,
  DollarSign,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { createFastTransaction } from "@/app/actions/cashBookActions";

interface FastTransactionEntryProps {
  onSuccess: () => void;
  recentDescriptions?: string[];
  projects?: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string; opening_balance: number }>;
  defaultProjectId?: string;
  allowProjectSelection?: boolean;
}

const CATEGORIES_SUGGESTIONS = [
  // HPP
  "Bahan Baku Utama / Material",
  "Upah Tukang",
  "Sewa Alat Proyek",
  "Transportasi Lapangan",
  // OPEX
  "Gaji dan Upah Karyawan",
  "Transportasi Operasional",
  "Biaya Konsumsi Kantor",
  "Biaya Jamuan / Representasi",
  "Biaya Marketing",
  "Kebutuhan Workshop",
  "Biaya Administrasi Finansial",
  // CAPEX
  "Renovasi Kantor",
  "Legalitas Perusahaan",
  "Inventaris",
  "Perangkat Gadget",
];

// Heuristik Saran Kategori Otomatis berdasarkan kata kunci
function guessCategory(desc: string): string | null {
  const lower = desc.toLowerCase();
  if (lower.includes("gaji") || lower.includes("gajian") || lower.includes("thr") || lower.includes("upah karyawan")) {
    return "Gaji dan Upah Karyawan";
  }
  if (lower.includes("grab") || lower.includes("gojek") || lower.includes("bensin") || lower.includes("tol") || lower.includes("parkir") || lower.includes("pertalite") || lower.includes("pertamax")) {
    return "Transportasi Operasional";
  }
  if (lower.includes("makan") || lower.includes("kopi") || lower.includes("snack") || lower.includes("konsumsi") || lower.includes("galon") || lower.includes("aqua") || lower.includes("makan siang")) {
    return "Biaya Konsumsi Kantor";
  }
  if (lower.includes("jamuan") || lower.includes("klien") || lower.includes("entertain") || lower.includes("meeting")) {
    return "Biaya Jamuan / Representasi";
  }
  if (lower.includes("ads") || lower.includes("iklan") || lower.includes("instagram") || lower.includes("flyer") || lower.includes("marketing") || lower.includes("brosur")) {
    return "Biaya Marketing";
  }
  if (lower.includes("admin") || lower.includes("pajak bca") || lower.includes("materai") || lower.includes("biaya bca") || lower.includes("bunga")) {
    return "Biaya Administrasi Finansial";
  }
  if (lower.includes("tukang") || lower.includes("mandor") || lower.includes("kenek") || lower.includes("lembur")) {
    return "Upah Tukang";
  }
  if (lower.includes("sewa") || lower.includes("scaffolding") || lower.includes("molen") || lower.includes("jack hammer")) {
    return "Sewa Alat Proyek";
  }
  if (lower.includes("semen") || lower.includes("pasir") || lower.includes("bata") || lower.includes("triplek") || lower.includes("hpl") || lower.includes("cat") || lower.includes("material")) {
    return "Bahan Baku Utama / Material";
  }
  if (lower.includes("renovasi") || lower.includes("cat kantor") || lower.includes("partisi")) {
    return "Renovasi Kantor";
  }
  if (lower.includes("laptop") || lower.includes("hp") || lower.includes("ipad") || lower.includes("gadget")) {
    return "Perangkat Gadget";
  }
  if (lower.includes("meja") || lower.includes("kursi") || lower.includes("lemari") || lower.includes("ac")) {
    return "Inventaris";
  }
  return null;
}

export function FastTransactionEntry({
  onSuccess,
  recentDescriptions = [],
  projects = [],
  accounts,
  defaultProjectId,
  allowProjectSelection = true,
}: FastTransactionEntryProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [cashAccountId, setCashAccountId] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smartSuggestion, setSmartSuggestion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const descInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accounts.some((account) => account.id === cashAccountId)) {
      setCashAccountId(accounts[0]?.id || "");
    }
  }, [accounts, cashAccountId]);

  const handleDescChange = (val: string) => {
    setDescription(val);
    const suggested = guessCategory(val);
    if (suggested) {
      setSmartSuggestion(suggested);
      if (!category) {
        setCategory(suggested);
      }
    } else {
      setSmartSuggestion(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!description.trim()) {
      setErrorMsg("Keterangan transaksi wajib diisi.");
      return;
    }
    if (!category) {
      setErrorMsg("Kategori transaksi wajib dipilih.");
      return;
    }
    if (!cashAccountId) {
      setErrorMsg("Pilih rekening atau kas yang menerima atau membayar transaksi.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMsg("Nominal pengeluaran harus lebih besar dari 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await createFastTransaction({
        date,
        description: description.trim(),
        category,
        amount: Number(amount),
        type,
        project_id: projectId || null,
        cash_account_id: cashAccountId,
      });

      // Reset form dan fokus kembali ke input keterangan agar siap input baris berikutnya
      setDescription("");
      setAmount("");
      setCategory("");
      setSmartSuggestion(null);
      if (descInputRef.current) {
        descInputRef.current.focus();
      }

      onSuccess();
    } catch (err: any) {
      console.error("Gagal simpan transaksi cepat:", err);
      setErrorMsg(err?.message || "Gagal menyimpan transaksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paste multiple rows dari Excel (Tab-delimited: Tanggal \t Keterangan \t Kategori \t Nominal)
  const handleBatchPasteSubmit = async () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n");
    setIsSubmitting(true);
    setErrorMsg(null);

    let successCount = 0;
    try {
      for (const line of lines) {
        const cols = line.split("\t");
        if (cols.length >= 2) {
          const rowDate = cols[0]?.trim() || new Date().toISOString().split("T")[0];
          const rowDesc = cols[1]?.trim() || "";
          let rowCat = cols[2]?.trim() || guessCategory(rowDesc) || "Biaya Konsumsi Kantor";
          const rawAmt = (cols[3] || cols[2] || "").replace(/[^0-9.]/g, "");
          const rowAmt = parseFloat(rawAmt) || 0;

          if (rowDesc && rowAmt > 0) {
            await createFastTransaction({
              date: rowDate.includes("-") ? rowDate : new Date().toISOString().split("T")[0],
              description: rowDesc,
              category: rowCat,
              amount: rowAmt,
              type: "EXPENSE",
              project_id: projectId || null,
              cash_account_id: cashAccountId,
            });
            successCount++;
          }
        }
      }

      setPasteModalOpen(false);
      setPasteText("");
      onSuccess();
    } catch (err: any) {
      setErrorMsg(`Gagal memproses paste Excel: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-zinc-100 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-950">Input Cepat Ala Excel</h4>
            <p className="text-[11px] text-zinc-500">
              Tekan Enter untuk simpan dan langsung lanjut ke baris berikutnya
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPasteModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors self-start sm:self-auto"
        >
          <Clipboard className="h-3.5 w-3.5 text-zinc-500" />
          <span>Paste Banyak Baris Excel</span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {smartSuggestion && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-[11px] text-blue-800 animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>Saran Kategori Otomatis: <strong>{smartSuggestion}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setCategory(smartSuggestion)}
            className="font-bold underline hover:text-blue-950"
          >
            Terapkan
          </button>
        </div>
      )}

      {/* Baris Input Inline Ala Excel */}
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div>
          <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Jenis transaksi
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as "INCOME" | "EXPENSE");
              setCategory("");
              setSmartSuggestion(null);
            }}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-900"
          >
            <option value="EXPENSE">Uang keluar</option>
            <option value="INCOME">Uang masuk</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Rekening / kas *
          </label>
          <select
            required
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-900"
          >
            <option value="">Pilih rekening / kas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>
        {allowProjectSelection && (
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Proyek (opsional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-900"
            >
              <option value="">Tidak terkait proyek</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
        {/* Tanggal */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
            Tanggal
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Keterangan dengan Datalist Autocomplete */}
        <div className="sm:col-span-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
            Keterangan Transaksi *
          </label>
          <input
            ref={descInputRef}
            type="text"
            required
            list="recent-descriptions"
            placeholder={type === "INCOME" ? "Misal: Pembayaran termin proyek..." : "Misal: Pembelian material proyek..."}
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
          <datalist id="recent-descriptions">
            {recentDescriptions.map((desc, i) => (
              <option key={i} value={desc} />
            ))}
          </datalist>
        </div>

        {/* Kategori (Wajib) */}
        <div className="sm:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
            Kategori (Wajib) *
          </label>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`h-9 w-full rounded-xl border px-2.5 text-xs font-semibold focus:border-zinc-950 focus:bg-white focus:outline-none ${
              category ? "border-zinc-200 bg-zinc-50 text-zinc-900" : "border-amber-300 bg-amber-50/50 text-amber-800"
            }`}
          >
            <option value="">-- Pilih Kategori --</option>
            {type === "INCOME" ? (
              <optgroup label="Kategori pemasukan">
                <option value="Pendapatan Proyek">Pendapatan Proyek</option>
                <option value="Setoran Modal">Setoran Modal</option>
                <option value="Bunga Bank">Bunga Bank</option>
                <option value="Pemasukan Lainnya">Pemasukan Lainnya</option>
              </optgroup>
            ) : <>
            <optgroup label="Harga Pokok Penjualan (HPP)">
              <option value="Bahan Baku Utama / Material">Bahan Baku Utama / Material</option>
              <option value="Upah Tukang">Upah Tukang</option>
              <option value="Sewa Alat Proyek">Sewa Alat Proyek</option>
              <option value="Transportasi Lapangan">Transportasi Lapangan</option>
            </optgroup>
            <optgroup label="Biaya Operasional (OPEX)">
              <option value="Gaji dan Upah Karyawan">Gaji dan Upah Karyawan</option>
              <option value="Transportasi Operasional">Transportasi Operasional</option>
              <option value="Biaya Konsumsi Kantor">Biaya Konsumsi Kantor</option>
              <option value="Biaya Jamuan / Representasi">Biaya Jamuan / Representasi</option>
              <option value="Biaya Marketing">Biaya Marketing</option>
              <option value="Kebutuhan Workshop">Kebutuhan Workshop</option>
              <option value="Biaya Administrasi Finansial">Biaya Administrasi Finansial</option>
            </optgroup>
            <optgroup label="Investasi & Aset (CAPEX)">
              <option value="Renovasi Kantor">Renovasi Kantor</option>
              <option value="Legalitas Perusahaan">Legalitas Perusahaan</option>
              <option value="Inventaris">Inventaris</option>
              <option value="Perangkat Gadget">Perangkat Gadget</option>
            </optgroup>
            </>}
          </select>
        </div>

        {/* Nominal (Rp) */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
            Nominal (Rp) *
          </label>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || "")}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none text-right"
          />
        </div>

        {/* Tombol Simpan (Enter to Submit) */}
        <div className="sm:col-span-1 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            title="Simpan (Enter)"
            className="h-9 w-full rounded-xl bg-zinc-950 flex items-center justify-center text-white hover:bg-black active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {/* Modal Paste Banyak Baris Excel */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPasteModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-zinc-950 mb-1">
              Paste Baris Transaksi dari Excel
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Salin baris pengeluaran dari Excel (Format kolom: <code>Tanggal [Tab] Keterangan [Tab] Kategori [Tab] Nominal</code>) lalu tempel di kotak berikut.
            </p>

            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="2026-06-12	Beli Karung	Bahan Baku Utama / Material	140000&#10;2026-06-15	Gojek Survey	Transportasi Operasional	45000"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBatchPasteSubmit}
                disabled={isSubmitting || !pasteText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Impor Baris Ini</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
