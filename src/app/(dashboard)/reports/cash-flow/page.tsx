"use client";

import { useState } from "react";
import { Download, Printer, Filter, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CashFlowActivity {
  description: string;
  amount: number;
}

interface CashFlowData {
  opening_balance: number;
  closing_balance: number;
  net_change: number;
  operating_activities: CashFlowActivity[];
  investing_activities: CashFlowActivity[];
  financing_activities: CashFlowActivity[];
}

const defaultCashFlowData: CashFlowData = {
  opening_balance: 442000000,
  operating_activities: [
    { description: "Collections from Client Project Invoices & Milestones", amount: 345000000 },
    { description: "Disbursements for Direct Materials & Trade Subcontractors", amount: -126000000 },
    { description: "Payroll Disbursements to Architects, Designers & Staff", amount: -38000000 },
    { description: "Studio Premises Lease, Cloud Subscriptions & Utilities", amount: -19500000 },
    { description: "Disbursement & Settlement of Project Site Advances", amount: -18500000 },
  ],
  investing_activities: [
    { description: "CapEx: BIM Workstations & High-End 3D Rendering Hardware", amount: -25000000 },
    { description: "Proceeds from Disposal of Decommissioned IT Equipment", amount: 4500000 },
  ],
  financing_activities: [
    { description: "Additional Capital Injected by Equity Partners", amount: 20000000 },
    { description: "Servicing of Commercial Bank Loan & Facility Interest", amount: -3500000 },
  ],
  net_change: 142500000,
  closing_balance: 584500000,
};

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<CashFlowData>(defaultCashFlowData);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setData(defaultCashFlowData);
      setIsLoading(false);
    }, 400);
  };

  const operatingTotal = data.operating_activities.reduce((sum, a) => sum + a.amount, 0);
  const investingTotal = data.investing_activities.reduce((sum, a) => sum + a.amount, 0);
  const financingTotal = data.financing_activities.reduce((sum, a) => sum + a.amount, 0);

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

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Opening Cash Equivalents
          </span>
          <p className="mt-1 text-2xl font-bold text-zinc-900 font-mono tabular-nums">
            {formatCurrency(data.opening_balance)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Beginning period treasury position</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Net Cash Flow Surplus
          </span>
          <p className="mt-1 text-2xl font-bold text-zinc-950 font-mono tabular-nums">
            +{formatCurrency(data.net_change)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Positive operational inflow conversion
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#09090B] p-5 shadow-sm text-white">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Ending Cash &amp; Bank Reserves
          </span>
          <p className="mt-1 text-2xl font-bold text-white font-mono tabular-nums">
            {formatCurrency(data.closing_balance)}
          </p>
          <p className="mt-1 text-xs text-zinc-400 font-mono">Liquid funds ready for deployment</p>
        </div>
      </div>

      {/* Cash Flow Statement Details */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
        {/* Operating Activities */}
        <div>
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              1. Cash Flows from Operating Activities
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 p-5">
            {data.operating_activities.map((act, idx) => (
              <div key={idx} className="flex justify-between py-2 text-xs">
                <span className="text-zinc-700 font-medium">{act.description}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                  }`}
                >
                  {act.amount >= 0 ? "+" : ""}
                  {formatCurrency(act.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-zinc-200 pt-3 font-bold text-xs text-zinc-900">
              <span>Net Cash Generated by Operating Activities</span>
              <span className="font-mono tabular-nums text-zinc-950">
                +{formatCurrency(operatingTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Investing Activities */}
        <div className="border-t border-zinc-200">
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              2. Cash Flows from Investing Activities (CapEx)
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 p-5">
            {data.investing_activities.map((act, idx) => (
              <div key={idx} className="flex justify-between py-2 text-xs">
                <span className="text-zinc-700 font-medium">{act.description}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                  }`}
                >
                  {act.amount >= 0 ? "+" : ""}
                  {formatCurrency(act.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-zinc-200 pt-3 font-bold text-xs text-zinc-900">
              <span>Net Cash Used in Investing Activities</span>
              <span className="font-mono tabular-nums text-rose-600">
                {formatCurrency(investingTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Financing Activities */}
        <div className="border-t border-zinc-200">
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              3. Cash Flows from Financing Activities
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 p-5">
            {data.financing_activities.map((act, idx) => (
              <div key={idx} className="flex justify-between py-2 text-xs">
                <span className="text-zinc-700 font-medium">{act.description}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                  }`}
                >
                  {act.amount >= 0 ? "+" : ""}
                  {formatCurrency(act.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-zinc-200 pt-3 font-bold text-xs text-zinc-900">
              <span>Net Cash Provided by Financing Activities</span>
              <span className="font-mono tabular-nums text-zinc-950">
                +{formatCurrency(financingTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Grand Summary */}
        <div className="border-t border-zinc-200 bg-zinc-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-bold">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
              Net Change in Cash Position
            </span>
            <p className="text-xl text-zinc-950 font-mono">
              +{formatCurrency(data.net_change)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
              Ending Treasury Cash &amp; Bank
            </span>
            <p className="text-2xl text-zinc-900 font-mono">
              {formatCurrency(data.closing_balance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
