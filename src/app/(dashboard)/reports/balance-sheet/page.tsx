"use client";

import { useState } from "react";
import { Download, Printer, Filter, ShieldCheck, CheckCircle2 } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface BalanceSheetData {
  assets: { code: string; name: string; amount: number }[];
  liabilities: { code: string; name: string; amount: number }[];
  equity: { code: string; name: string; amount: number }[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  current_profit_loss: number;
}

const defaultBalanceSheetData: BalanceSheetData = {
  assets: [
    { code: "1110", name: "Petty Cash & Studio Float", amount: 24000000 },
    { code: "1120", name: "BCA Treasury & Payroll Operating Account", amount: 342000000 },
    { code: "1130", name: "Mandiri Commercial Escrow & Vendor Account", amount: 218500000 },
    { code: "1210", name: "Accounts Receivable & Unbilled Client WIP", amount: 98000000 },
    { code: "1310", name: "Field Cash Advances & Prepayments", amount: 18500000 },
    { code: "1510", name: "BIM Workstations & Server Hardware", amount: 85000000 },
    { code: "1520", name: "Less: Accumulated Depreciation", amount: -15000000 },
  ],
  liabilities: [
    { code: "2110", name: "Accounts Payable to Subcontractors & Suppliers", amount: 34500000 },
    { code: "2120", name: "Unearned Retainer Revenue & Client Deposits", amount: 45000000 },
    { code: "2130", name: "Accrued Corporate & Withholding Taxes", amount: 12500000 },
  ],
  equity: [
    { code: "3110", name: "Paid-in Share Capital", amount: 450000000 },
    { code: "3210", name: "Retained Earnings (Prior Years)", amount: 88350000 },
  ],
  total_assets: 771000000,
  total_liabilities: 92000000,
  total_equity: 538350000,
  current_profit_loss: 140650000,
};

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<BalanceSheetData>(defaultBalanceSheetData);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setData(defaultBalanceSheetData);
      setIsLoading(false);
    }, 400);
  };

  const totalLiabilitiesAndEquity =
    data.total_liabilities + data.total_equity + data.current_profit_loss;
  const isBalanced = data.total_assets === totalLiabilitiesAndEquity;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Filter and Action Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">As of Date:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isLoading ? "Generating..." : "Apply Date Filter"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            Print PDF
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm">
            <Download className="h-3.5 w-3.5 text-zinc-900" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Balance Verification Banner */}
      <div
        className={`flex items-center gap-3 rounded-2xl p-4 border ${
          isBalanced
            ? "border-zinc-300 bg-zinc-50 text-zinc-900"
            : "border-rose-200 bg-rose-50 text-rose-800"
        }`}
      >
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-zinc-950" />
        <div className="text-xs">
          <span className="font-bold">
            {isBalanced
              ? "Perfect Accounting Equilibrium Verified (Balanced)"
              : "Warning: Unbalanced Accounting Ledger"}
          </span>
          <p className="mt-0.5 text-zinc-500 font-mono">
            Total Assets ({formatCurrency(data.total_assets)}) = Total Liabilities &amp; Stockholder Equity ({formatCurrency(totalLiabilitiesAndEquity)})
          </p>
        </div>
      </div>

      {/* Two Column Balance Sheet */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ASSETS */}
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                ENTERPRISE CAPITAL
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">ASSETS &amp; RECEIVABLES</h2>
            </div>
            <div className="divide-y divide-zinc-100 p-5 space-y-1">
              {data.assets.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                    <span className="font-medium text-zinc-700">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-5 flex justify-between items-center font-bold text-sm">
            <span className="text-zinc-900 uppercase tracking-tight">TOTAL ASSETS</span>
            <span className="font-mono tabular-nums text-zinc-950 text-base">
              {formatCurrency(data.total_assets)}
            </span>
          </div>
        </div>

        {/* LIABILITIES & EQUITY */}
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                OBLIGATIONS &amp; CAPITAL
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">LIABILITIES &amp; SHAREHOLDER EQUITY</h2>
            </div>

            <div className="p-5 space-y-6 text-xs">
              {/* Liabilities */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1 font-mono">
                  1. Current &amp; Non-Current Liabilities
                </h4>
                <div className="divide-y divide-zinc-100">
                  {data.liabilities.map((item) => (
                    <div key={item.code} className="flex justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                        <span className="font-medium text-zinc-700">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-rose-600 font-semibold">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-1 font-bold text-zinc-800">
                  <span>Subtotal Liabilities</span>
                  <span className="font-mono">{formatCurrency(data.total_liabilities)}</span>
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1 font-mono">
                  2. Shareholder Equity &amp; Retained Capital
                </h4>
                <div className="divide-y divide-zinc-100">
                  {data.equity.map((item) => (
                    <div key={item.code} className="flex justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                        <span className="font-medium text-zinc-700">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-500 w-12">YTD</span>
                      <span className="font-bold text-zinc-900">Current Year Net Operating Surplus</span>
                    </div>
                    <span className="font-mono tabular-nums text-zinc-900 font-bold">
                      {formatCurrency(data.current_profit_loss)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between pt-1 font-bold text-zinc-800">
                  <span>Subtotal Equity &amp; Retained Earnings</span>
                  <span className="font-mono">
                    {formatCurrency(data.total_equity + data.current_profit_loss)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-5 flex justify-between items-center font-bold text-sm">
            <span className="text-zinc-900 uppercase tracking-tight">TOTAL LIABILITIES &amp; EQUITY</span>
            <span className="font-mono tabular-nums text-zinc-950 text-base">
              {formatCurrency(totalLiabilitiesAndEquity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
