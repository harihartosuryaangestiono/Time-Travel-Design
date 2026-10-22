import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 mb-4">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900">Halaman Tidak Ditemukan</h2>
      <p className="mt-1.5 max-w-md text-xs text-zinc-500 leading-relaxed">
        Halaman atau dokumen keuangan yang Anda cari tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black active:scale-95"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Kembali ke Dashboard</span>
      </Link>
    </div>
  );
}
