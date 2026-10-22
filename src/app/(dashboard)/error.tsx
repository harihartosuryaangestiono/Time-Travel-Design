"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900">Terjadi Kesalahan</h2>
      <p className="mt-1.5 max-w-md text-xs text-zinc-500 leading-relaxed">
        {error.message || "Gagal memuat halaman atau data dashboard. Silakan coba muat ulang."}
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black active:scale-95"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Coba Lagi</span>
      </button>
    </div>
  );
}
