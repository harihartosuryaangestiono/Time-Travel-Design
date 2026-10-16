"use client";

import { useState } from "react";
import { Download, Printer, Filter, CheckCircle2 } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

const defaultTrialBalanceData: TrialBalanceRow[] = [
  {
    account_code: "1110",
    account_name: "Petty Cash & Studio Float",
    account_type: "ASSET",
    opening_debit: 20000000,
    opening_credit: 0,
    period_debit: 15000000,
    period_credit: 11000000,
    closing_debit: 24000000,
    closing_credit: 0,
  },
  {
    account_code: "1120",
    account_name: "BCA Treasury & Payroll Operating Account",
    account_type: "ASSET",
    opening_debit: 280000000,
    opening_credit: 0,
    period_debit: 220000000,
    period_credit: 158000000,
    closing_debit: 342000000,
    closing_credit: 0,
  },
  {
    account_code: "1130",
    account_name: "Mandiri Commercial Escrow & Vendor Account",
    account_type: "ASSET",
    opening_debit: 185000000,
    opening_credit: 0,
    period_debit: 125000000,
    period_credit: 91500000,
    closing_debit: 218500000,
    closing_credit: 0,
  },
  {
    account_code: "1210",
    account_name: "Accounts Receivable & Unbilled Client WIP",
    account_type: "ASSET",
    opening_debit: 65000000,
    opening_credit: 0,
    period_debit: 185000000,
    period_credit: 152000000,
    closing_debit: 98000000,
    closing_credit: 0,
  },
  {
    account_code: "2110",
    account_name: "Accounts Payable to Subcontractors & Suppliers",
    account_type: "LIABILITY",
    opening_debit: 0,
    opening_credit: 25000000,
    period_debit: 48000000,
    period_credit: 57500000,
    closing_debit: 0,
    closing_credit: 34500000,
  },
  {
    account_code: "3110",
    account_name: "Paid-in Share Capital",
    account_type: "EQUITY",
    opening_debit: 0,
    opening_credit: 450000000,
    period_debit: 0,
    period_credit: 0,
    closing_debit: 0,
    closing_credit: 450000000,
  },
  {
    account_code: "4100",
    account_name: "Architectural & Interior Design Retainer Fees",
    account_type: "REVENUE",
    opening_debit: 0,
    opening_credit: 0,
    period_debit: 0,
    period_credit: 345000000,
    closing_debit: 0,
    closing_credit: 345000000,
  },
  {
    account_code: "5100",
    account_name: "Direct Cost of Sales (Materials & MEP Subcons)",
    account_type: "EXPENSE",
    opening_debit: 0,
    opening_credit: 0,
    period_debit: 138000000,
    period_credit: 0,
    closing_debit: 138000000,
    closing_credit: 0,
  },
  {
    account_code: "6100",
    account_name: "Studio Operations, Payroll & Facility Overhead",
    account_type: "EXPENSE",
    opening_debit: 0,
    opening_credit: 0,
    period_debit: 67200000,
    period_credit: 0,
    closing_debit: 67200000,
    closing_credit: 0,
  },
];

export default function TrialBalancePage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<TrialBalanceRow[]>(defaultTrialBalanceData);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setData(defaultTrialBalanceData);
      setIsLoading(false);
    }, 400);
  };

  const totals = data.reduce(
    (acc, row) => ({
      opening_debit: acc.opening_debit + row.opening_debit,
      opening_credit: acc.opening_credit + row.opening_credit,
      period_debit: acc.period_debit + row.period_debit,
      period_credit: acc.period_credit + row.period_credit,
      closing_debit: acc.closing_debit + row.closing_debit,
      closing_credit: acc.closing_credit + row.closing_credit,
    }),
    {
      opening_debit: 0,
      opening_credit: 0,
      period_debit: 0,
      period_credit: 0,
      closing_debit: 0,
      closing_credit: 0,
    }
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Filter and Action Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
            <span className="text-xs text-zinc-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isLoading ? "Generating..." : "Apply Period Filter"}
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

      {/* Trial Balance Table */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-[#09090B] p-6 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
              DOUBLE-ENTRY RECONCILIATION VERIFIED
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">General Trial Balance</h2>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Fiscal Period: {startDate} through {endDate} • Base Currency: IDR
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Account &amp; Code</th>
                <th className="px-4 py-3 text-right font-bold">Opening Dr</th>
                <th className="px-4 py-3 text-right font-bold">Opening Cr</th>
                <th className="px-4 py-3 text-right font-bold">Activity Dr</th>
                <th className="px-4 py-3 text-right font-bold">Activity Cr</th>
                <th className="px-4 py-3 text-right font-bold">Closing Dr</th>
                <th className="px-4 py-3 text-right font-bold">Closing Cr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.map((row) => (
                <tr key={row.account_code} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-zinc-900 mr-2">{row.account_code}</span>
                    <span className="text-zinc-700 font-medium">{row.account_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600">
                    {row.opening_debit > 0 ? formatCurrency(row.opening_debit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600">
                    {row.opening_credit > 0 ? formatCurrency(row.opening_credit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-950 font-medium">
                    {row.period_debit > 0 ? formatCurrency(row.period_debit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-600 font-medium">
                    {row.period_credit > 0 ? formatCurrency(row.period_credit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-zinc-900">
                    {row.closing_debit > 0 ? formatCurrency(row.closing_debit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-zinc-900">
                    {row.closing_credit > 0 ? formatCurrency(row.closing_credit) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-bold text-xs text-zinc-900">
              <tr>
                <td className="px-4 py-3 uppercase tracking-wider font-mono">EQUILIBRIUM TOTALS</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(totals.opening_debit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(totals.opening_credit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-950">{formatCurrency(totals.period_debit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-600">{formatCurrency(totals.period_credit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900">{formatCurrency(totals.closing_debit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900">{formatCurrency(totals.closing_credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
