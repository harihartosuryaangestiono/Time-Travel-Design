"use client";

import { useState } from "react";
import { Download, Printer, Calendar, TrendingUp, Filter, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface IncomeStatementData {
  revenue: { code: string; name: string; amount: number }[];
  cost_of_sales: { code: string; name: string; amount: number }[];
  operating_expenses: { code: string; name: string; amount: number }[];
  other_income: { code: string; name: string; amount: number }[];
  other_expenses: { code: string; name: string; amount: number }[];
  gross_profit: number;
  net_profit: number;
  total_revenue: number;
  total_cost_of_sales: number;
  total_operating_expenses: number;
  total_other_income: number;
  total_other_expenses: number;
}

const defaultReportData: IncomeStatementData = {
  revenue: [
    { code: "4100", name: "Architectural Masterplanning & Design Retainers", amount: 185000000 },
    { code: "4200", name: "Turnkey Interior Design & Specification Fees", amount: 125000000 },
    { code: "4300", name: "Construction Administration & Site Supervision", amount: 35000000 },
  ],
  cost_of_sales: [
    { code: "5100", name: "Direct Material Procurement & Bespoke Finishes", amount: 78000000 },
    { code: "5200", name: "Specialist MEP Engineering & Trade Subcontractors", amount: 48000000 },
    { code: "5300", name: "Permitting, Statutory Approvals & BIM Documentation", amount: 12000000 },
  ],
  operating_expenses: [
    { code: "6100", name: "Design Team Salaries & Executive Payroll", amount: 38000000 },
    { code: "6200", name: "Studio Premises Lease & Facilities", amount: 15000000 },
    { code: "6300", name: "Utilities, Fiber Telecom & Cloud Hosting", amount: 4500000 },
    { code: "6400", name: "CAD, BIM, Rhino & 3D Rendering Subscriptions", amount: 6500000 },
    { code: "6500", name: "Site Logistics, Travel & Client Hospitality", amount: 3200000 },
  ],
  other_income: [
    { code: "7100", name: "Treasury Deposit Interest & Forex Yield", amount: 1200000 },
  ],
  other_expenses: [
    { code: "8100", name: "Banking Service Fees & Withholding Taxes", amount: 350000 },
  ],
  total_revenue: 345000000,
  total_cost_of_sales: 138000000,
  gross_profit: 207000000,
  total_operating_expenses: 67200000,
  total_other_income: 1200000,
  total_other_expenses: 350000,
  net_profit: 140650000,
};

export default function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<IncomeStatementData>(defaultReportData);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setData(defaultReportData);
      setIsLoading(false);
    }, 400);
  };

  const grossMargin = ((data.gross_profit / data.total_revenue) * 100).toFixed(1);
  const netMargin = ((data.net_profit / data.total_revenue) * 100).toFixed(1);

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
            {isLoading ? "Generating..." : "Apply Filter"}
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

      {/* Financial Statement Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
        {/* Document Header */}
        <div className="border-b border-zinc-100 bg-[#09090B] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
                AUDITED FINANCIAL STATEMENT
              </span>
              <span className="text-xs text-zinc-400 font-mono">PT Desain Lintas Masa</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-white">
              Statement of Profit &amp; Loss
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Reporting Period: {startDate} through {endDate} • Base Currency: IDR
            </p>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Gross Margin</span>
              <p className="text-lg font-bold text-white font-mono">{grossMargin}%</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Net Margin</span>
              <p className="text-lg font-bold text-white font-mono">{netMargin}%</p>
            </div>
          </div>
        </div>

        {/* Statement Body */}
        <div className="p-6 sm:p-8 space-y-8 text-sm">
          {/* Section 1: Revenue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
              <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                1. Operating Revenue &amp; Architectural Fees
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-semibold">ACCOUNT CODE</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {data.revenue.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-900 font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
              <span>Total Operating Revenue</span>
              <span className="font-mono tabular-nums text-zinc-900">
                {formatCurrency(data.total_revenue)}
              </span>
            </div>
          </div>

          {/* Section 2: COGS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
              <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                2. Cost of Project Delivery &amp; Direct Materials (COGS)
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-semibold">ACCOUNT CODE</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {data.cost_of_sales.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-rose-600 font-medium">
                    ({formatCurrency(item.amount)})
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
              <span>Total Cost of Sales</span>
              <span className="font-mono tabular-nums text-rose-600">
                ({formatCurrency(data.total_cost_of_sales)})
              </span>
            </div>
          </div>

          {/* Subtotal: Gross Profit */}
          <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-200 flex justify-between items-center font-bold text-base">
            <span className="text-zinc-900 tracking-tight">GROSS OPERATING PROFIT</span>
            <span className="font-mono tabular-nums text-zinc-900 text-lg">
              {formatCurrency(data.gross_profit)}
            </span>
          </div>

          {/* Section 3: OPEX */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
              <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                3. Studio Operating Expenses (OPEX)
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-semibold">ACCOUNT CODE</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {data.operating_expenses.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-rose-600 font-medium">
                    ({formatCurrency(item.amount)})
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
              <span>Total Operating Expenses</span>
              <span className="font-mono tabular-nums text-rose-600">
                ({formatCurrency(data.total_operating_expenses)})
              </span>
            </div>
          </div>

          {/* Section 4: Other Income & Expenses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
              <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                4. Non-Operating Income &amp; Financing Costs
              </h3>
              <span className="text-xs text-zinc-400 font-mono font-semibold">ACCOUNT CODE</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {data.other_income.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-700 font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {data.other_expenses.map((item) => (
                <div key={item.code} className="flex justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-rose-600 font-medium">
                    ({formatCurrency(item.amount)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total: Net Profit */}
          <div className="rounded-2xl bg-[#09090B] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-zinc-800">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-bold">
                PERIOD FINANCIAL RESULT
              </p>
              <h4 className="text-2xl font-bold mt-0.5 tracking-tight text-white">NET OPERATING PROFIT</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Positive net income generated with healthy operating cash flow conversion
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="font-mono text-3xl font-black tabular-nums tracking-tight text-white">
                {formatCurrency(data.net_profit)}
              </div>
              <span className="inline-block mt-1 rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-300 font-mono">
                Net Margin: {netMargin}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
