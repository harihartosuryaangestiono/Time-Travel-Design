"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  FileText,
  Coins,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  FolderKanban,
  ArrowRightLeft,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Layers,
  PieChart as PieIcon,
  BarChart3,
  Flame,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { BrandIconSvg } from "@/components/ui/BrandLogo";
import { cn } from "@/lib/utils";

// Format currency in Rupiah
function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format short currency (e.g. 1.2 B, 450 M)
function formatShortIDR(amount: number) {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} B`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(0)} M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)} K`;
  }
  return amount.toString();
}

// Fallback demo dataset for rich analytics display
const defaultMonthlyTrend = [
  { month: "May 2024", income: 185000000, expense: 120000000, profit: 65000000, margin: 35.1 },
  { month: "Jun 2024", income: 240000000, expense: 145000000, profit: 95000000, margin: 39.5 },
  { month: "Jul 2024", income: 210000000, expense: 160000000, profit: 50000000, margin: 23.8 },
  { month: "Aug 2024", income: 295000000, expense: 175000000, profit: 120000000, margin: 40.6 },
  { month: "Sep 2024", income: 280000000, expense: 182000000, profit: 98000000, margin: 35.0 },
  { month: "Oct 2024", income: 345000000, expense: 198500000, profit: 146500000, margin: 42.4 },
];

const defaultExpenseCategories = [
  { name: "Designers & Architects Compensation", value: 85000000, color: "#18181B", percent: "42.8%" },
  { name: "Project Materials & Subcontractors", value: 54000000, color: "#27272A", percent: "27.2%" },
  { name: "Studio Lease & Utilities", value: 24000000, color: "#3F3F46", percent: "12.1%" },
  { name: "Software, Cloud & CAD Licensing", value: 16500000, color: "#52525B", percent: "8.3%" },
  { name: "Site Logistics & Field Inspections", value: 11500000, color: "#71717A", percent: "5.8%" },
  { name: "Office Overhead & Miscellaneous", value: 7500000, color: "#A1A1AA", percent: "3.8%" },
];

const defaultProjectBudgets = [
  {
    id: "p1",
    code: "PRJ-24-001",
    name: "Luxury Villa Canggu Bali",
    client: "PT Bali Resort Investama",
    contract: 520000000,
    spent: 312000000,
    committed: 65000000,
    progress: 60,
    status: "ON TRACK",
  },
  {
    id: "p2",
    code: "PRJ-24-002",
    name: "Senopati Modern Industrial Cafe",
    client: "Kopi Senopati Group",
    contract: 280000000,
    spent: 215000000,
    committed: 30000000,
    progress: 77,
    status: "ATTENTION",
  },
  {
    id: "p3",
    code: "PRJ-24-003",
    name: "Masterplan Office Tower BSD",
    client: "PT Sinarmas Mitra Kreasi",
    contract: 780000000,
    spent: 340000000,
    committed: 110000000,
    progress: 44,
    status: "ON TRACK",
  },
  {
    id: "p4",
    code: "PRJ-24-004",
    name: "Classic Menteng Residence",
    client: "Mr. Hendra Gunawan",
    contract: 420000000,
    spent: 120000000,
    committed: 45000000,
    progress: 29,
    status: "ON TRACK",
  },
  {
    id: "p5",
    code: "PRJ-24-005",
    name: "Ubud Boutique Wellness Resort",
    client: "PT Ubud Sanctuary Living",
    contract: 890000000,
    spent: 590000000,
    committed: 180000000,
    progress: 66,
    status: "ATTENTION",
  },
];

const defaultRecentTransactions = [
  {
    id: "tx-1",
    date: "2024-10-14",
    description: "Carrara marble procurement for Villa Canggu project",
    category: "Project Material",
    merchant: "PT Marmer Indah Sentosa",
    amount: 32500000,
    type: "expense",
    status: "POSTED",
  },
  {
    id: "tx-2",
    date: "2024-10-12",
    description: "Milestone 2 progress payment - BSD Masterplan PRJ-24-003",
    category: "Client Billing",
    merchant: "PT Sinarmas Mitra Kreasi",
    amount: 156000000,
    type: "income",
    status: "PAID",
  },
  {
    id: "tx-3",
    date: "2024-10-10",
    description: "Architect & BIM lead site inspection cash advance",
    category: "Cash Advance",
    merchant: "Rian Pratama (Lead Architect)",
    amount: 4500000,
    type: "advance",
    status: "APPROVED",
  },
  {
    id: "tx-4",
    date: "2024-10-08",
    description: "Autodesk Revit & 3ds Max studio enterprise subscription",
    category: "Software & CAD",
    merchant: "Autodesk Pte Ltd",
    amount: 14200000,
    type: "expense",
    status: "POSTED",
  },
  {
    id: "tx-5",
    date: "2024-10-05",
    description: "Milestone 1 progress payment - Senopati Cafe interior",
    category: "Client Billing",
    merchant: "Kopi Senopati Group",
    amount: 84000000,
    type: "income",
    status: "PAID",
  },
  {
    id: "tx-6",
    date: "2024-10-02",
    description: "Electrical & architectural lighting subcontractor fee",
    category: "Subcontractor",
    merchant: "CV Cipta Tata Cahaya",
    amount: 22000000,
    type: "expense",
    status: "POSTED",
  },
];

export default function DashboardContent() {
  const [period, setPeriod] = useState("this_month");
  const [chartView, setChartView] = useState<"flow" | "margin" | "cumulative">("flow");
  const [isLoading, setIsLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<"all" | "expense" | "income" | "advance">("all");

  const [metrics, setMetrics] = useState({
    totalCash: 584500000,
    totalIncome: 345000000,
    totalExpense: 198500000,
    netProfit: 146500000,
    profitMargin: 42.4,
    totalReceivable: 98000000,
    totalPayable: 34500000,
    pendingApprovals: 3,
    overdueInvoices: 1,
    accountsCount: 3,
    cashRunwayMonths: 8.8,
  });

  const [accounts, setAccounts] = useState([
    { name: "BCA Corporate Checking", balance: 342000000, number: "•••• 8912" },
    { name: "Mandiri Business Treasury", balance: 218500000, number: "•••• 4421" },
    { name: "Studio Petty Cash Vault", balance: 24000000, number: "Vault Cash" },
  ]);

  const [trendData, setTrendData] = useState(defaultMonthlyTrend);
  const [expenseCategories, setExpenseCategories] = useState(defaultExpenseCategories);
  const [projects, setProjects] = useState(defaultProjectBudgets);
  const [recentTx, setRecentTx] = useState(defaultRecentTransactions);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (member) {
        const orgId = member.organization_id;

        const { data: realAccounts } = await supabase
          .from("cash_accounts")
          .select("id, name, opening_balance, account_number")
          .eq("organization_id", orgId)
          .eq("is_active", true);

        if (realAccounts && realAccounts.length > 0) {
          const mappedAccounts = realAccounts.map((a) => ({
            name: a.name,
            balance: Number(a.opening_balance || 0),
            number: a.account_number ? `•••• ${a.account_number.slice(-4)}` : "Cash",
          }));
          const realCash = mappedAccounts.reduce((s, a) => s + a.balance, 0);

          setAccounts(mappedAccounts);
          setMetrics((prev) => ({
            ...prev,
            totalCash: realCash,
            accountsCount: mappedAccounts.length,
          }));
        }

        const { count: pendingCount } = await supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "SUBMITTED");

        if (pendingCount !== null) {
          setMetrics((prev) => ({
            ...prev,
            pendingApprovals: pendingCount,
          }));
        }

        const { data: realTx } = await supabase
          .from("expenses")
          .select("id, date, description, total_amount, status, category, merchant")
          .eq("organization_id", orgId)
          .order("date", { ascending: false })
          .limit(6);

        if (realTx && realTx.length > 0) {
          const mapped = realTx.map((t) => ({
            id: t.id,
            date: t.date,
            description: t.description || "Project Expenditure",
            category: t.category || "Operations",
            merchant: t.merchant || "Contractor Partner",
            amount: Number(t.total_amount || 0),
            type: "expense",
            status: t.status || "POSTED",
          }));
          setRecentTx(mapped);
        }
      }
    } catch (e) {
      console.warn("Using enriched demonstration analytics dataset", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTx = recentTx.filter((t) => {
    if (txFilter === "all") return true;
    return t.type === txFilter;
  });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* ── Top Bar: Welcome & Financial Context ── */}
      <div className="flex flex-col gap-5 rounded-3xl border border-zinc-800 bg-gradient-to-r from-[#09090B] via-[#121212] to-[#18181B] p-6 sm:p-8 text-white shadow-2xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 p-2 shadow-inner">
            <BrandIconSvg fill="#FFFFFF" className="h-6 w-auto" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Financial Intelligence
              </span>
              <span className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs text-zinc-300 border border-zinc-700 font-mono text-[10px] tracking-wider uppercase">
                TIME TRAVEL DESIGN
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Financial Performance &amp; Cash Flow Overview
            </h2>
            <p className="text-xs text-zinc-400 sm:text-sm max-w-2xl leading-relaxed">
              Real-time monitoring of project revenues, operating margins, budget pacing,
              and studio treasury liquidity in one unified intelligence platform.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Selector */}
          <div className="flex items-center rounded-xl bg-zinc-900 p-1 text-xs font-medium text-zinc-300 border border-zinc-800">
            {[
              { id: "this_month", label: "This Month" },
              { id: "last_quarter", label: "Q3 2024" },
              { id: "ytd", label: "Full Year 2024" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all duration-150",
                  period === p.id
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchDashboardData()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
            title="Refresh analytics data"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Executive Financial Vitality Strip (Runway, Burn Rate, Margin) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash Runway</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-zinc-950 tabular-nums">
            {metrics.cashRunwayMonths} Months
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Well Funded (&gt; 6 mos)
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Profit Margin</span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 tabular-nums">
            {metrics.profitMargin}%
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Studio benchmark: 30%
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Quick Liquidity (QR)</span>
            <ShieldCheck className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-xl font-bold text-zinc-950 tabular-nums">
            3.4x
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            High solvency coverage
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Budget Adherence</span>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-zinc-950 tabular-nums">
            93.8%
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Expenditure within cap
          </p>
        </div>
      </div>

      {/* ── 6 Core Financial KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Cash & Bank */}
        <StatCard
          title="Total Liquidity & Treasury"
          value={formatIDR(metrics.totalCash)}
          subtitle={`${accounts.length} active accounts linked`}
          trend={{ value: "+8.4%", isPositive: true }}
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          badge="Liquid"
          gradient
        />

        {/* Total Inflow / Pendapatan */}
        <StatCard
          title="Operating Inflows (Cash In)"
          value={formatIDR(metrics.totalIncome)}
          subtitle="94% of monthly target achieved"
          trend={{ value: "+14.2%", isPositive: true }}
          icon={ArrowDownRight}
          iconBgColor="bg-teal-500/10"
          iconColor="text-teal-700"
        />

        {/* Total Outflow / Pengeluaran */}
        <StatCard
          title="Total Outflows (Expenditures)"
          value={formatIDR(metrics.totalExpense)}
          subtitle="OPEX + Direct Project Costs"
          trend={{ value: "-4.1%", isPositive: true, isGood: true }}
          icon={Receipt}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        />

        {/* Laba Bersih */}
        <StatCard
          title="Net Operating Income"
          value={formatIDR(metrics.netProfit)}
          subtitle={`Net margin ${metrics.profitMargin}%`}
          trend={{ value: "+22.5%", isPositive: true }}
          icon={TrendingUp}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />

        {/* Piutang Tertagih */}
        <StatCard
          title="Accounts Receivable (A/R)"
          value={formatIDR(metrics.totalReceivable)}
          subtitle={`${metrics.overdueInvoices} invoice past payment term`}
          trend={{ value: "1 overdue", isPositive: false }}
          icon={FileText}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />

        {/* Hutang & Kasbon Berjalan */}
        <StatCard
          title="Payables & Open Advances"
          value={formatIDR(metrics.totalPayable)}
          subtitle="Unsettled advances & vendor bills"
          trend={{ value: "2 pending", isPositive: true }}
          icon={Coins}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
      </div>

      {/* ── Operational Urgency Alert Banner ── */}
      {metrics.pendingApprovals > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-950">
                You have {metrics.pendingApprovals} expenditure &amp; cash advance requests awaiting authorization
              </p>
              <p className="text-xs text-amber-800">
                Verify receipt proof and project budget allocation before funds are disbursed.
              </p>
            </div>
          </div>
          <Link
            href="/approvals"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            Open Approval Center
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* ── Deep Analytics Section (Charts) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Chart: Cash Flow & Trends (7 cols) */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-zinc-950" />
                Cash Flow Dynamics &amp; Net Profit Growth
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Monthly comparison of cash inflows, operating outflows, and net margin velocity
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex items-center rounded-xl bg-zinc-100 p-1 text-xs font-medium">
              <button
                onClick={() => setChartView("flow")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-all",
                  chartView === "flow"
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Inflows vs Outflows
              </button>
              <button
                onClick={() => setChartView("margin")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-all",
                  chartView === "margin"
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                Net Profit Trend
              </button>
            </div>
          </div>

          <div className="mt-6 h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === "flow" ? (
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#71717A" }}
                    axisLine={{ stroke: "#E4E4E7" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717A" }}
                    tickFormatter={(val) => formatShortIDR(val)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-zinc-900">{label}</p>
                            <p className="text-emerald-700 font-semibold">
                              Inflow: {formatIDR(Number(payload[0]?.value || 0))}
                            </p>
                            <p className="text-rose-600 font-semibold">
                              Outflow: {formatIDR(Number(payload[1]?.value || 0))}
                            </p>
                            <p className="text-zinc-500 pt-1 border-t border-zinc-100">
                              Net Profit: {formatIDR(Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0))}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Operating Inflows (In)"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorIncome)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Operating Outflows (Out)"
                    stroke="#F43F5E"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorExpense)"
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#71717A" }}
                    axisLine={{ stroke: "#E4E4E7" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#71717A" }}
                    tickFormatter={(val) => formatShortIDR(val)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-zinc-900">{label}</p>
                            <p className="text-emerald-700 font-semibold">
                              Net Profit: {formatIDR(Number(payload[0]?.value || 0))}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="profit"
                    name="Net Operating Profit"
                    fill="#18181B"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-50 p-3 text-center text-xs">
            <div>
              <span className="text-zinc-500">Average Inflows</span>
              <p className="font-bold text-zinc-900 mt-0.5">IDR 262 M / mo</p>
            </div>
            <div>
              <span className="text-zinc-500">Average Burn Rate</span>
              <p className="font-bold text-rose-600 mt-0.5">IDR 163 M / mo</p>
            </div>
            <div>
              <span className="text-zinc-500">Average Net Profit</span>
              <p className="font-bold text-emerald-700 mt-0.5">IDR 99 M / mo</p>
            </div>
          </div>
        </div>

        {/* Expense Category Breakdown (5 cols) */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <PieIcon className="h-5 w-5 text-zinc-950" />
                  Expenditure Allocation
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Distribution of direct project costs &amp; studio overhead
                </p>
              </div>
              <Badge variant="neutral">Oct 2024</Badge>
            </div>

            <div className="mt-4 h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-xl text-xs">
                            <p className="font-bold text-zinc-900">{data.name}</p>
                            <p className="text-zinc-900 font-semibold mt-0.5">
                              {formatIDR(data.value)} ({data.percent})
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category List */}
          <div className="space-y-2 mt-2">
            {expenseCategories.slice(0, 4).map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between rounded-xl p-2 text-xs hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-zinc-800 truncate max-w-[150px] sm:max-w-[200px]">
                    {cat.name}
                  </span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="font-bold text-zinc-900">
                    {formatShortIDR(cat.value)}
                  </span>
                  <span className="text-zinc-400 ml-1.5 text-[10px]">
                    ({cat.percent})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Project Budget Realization Matrix ── */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-zinc-950" />
              Project Budget Pacing &amp; Margin Protection
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Monitor cost absorption and procurement commitments against contracted value
            </p>
          </div>
          <Link
            href="/projects"
            className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1"
          >
            View All Projects ({projects.length})
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {projects.map((prj) => {
            const consumedPercent = Math.min(100, Math.round(((prj.spent + prj.committed) / prj.contract) * 100));
            const remainingBudget = prj.contract - prj.spent - prj.committed;

            return (
              <div
                key={prj.id}
                className="rounded-2xl border border-zinc-200/80 p-4 hover:border-zinc-300 transition-all bg-zinc-50/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-800">
                        {prj.code}
                      </span>
                      <h4 className="text-sm font-bold text-zinc-900">
                        {prj.name}
                      </h4>
                      <Badge
                        variant={prj.status === "ON TRACK" ? "success" : "warning"}
                        size="sm"
                      >
                        {prj.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Client: {prj.client}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-right text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                        Contract Value
                      </span>
                      <p className="font-bold text-zinc-900 tabular-nums">
                        {formatIDR(prj.contract)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                        Actual + Committed
                      </span>
                      <p className="font-bold text-rose-600 tabular-nums">
                        {formatIDR(prj.spent + prj.committed)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                        Remaining Buffer
                      </span>
                      <p className="font-bold text-emerald-700 tabular-nums">
                        {formatIDR(remainingBudget)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                    <span>Budget Consumption</span>
                    <span>{consumedPercent}% allocated</span>
                  </div>
                  <ProgressBar
                    value={consumedPercent}
                    size="sm"
                    variant={consumedPercent > 80 ? "amber" : "emerald"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Grid: Cash Accounts & Recent Transactions Feed ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Liquid Accounts Overview (4 cols) */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-zinc-950" />
                  Treasury &amp; Bank Accounts
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Real-time balances across operational accounts
                </p>
              </div>
              <Link
                href="/cash-accounts"
                className="text-xs font-semibold text-zinc-900 hover:underline"
              >
                Manage
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {accounts.map((acc) => (
                <div
                  key={acc.name}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 shadow-sm hover:border-zinc-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">
                        {acc.name}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        {acc.number}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                      Active
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-bold text-zinc-950 tabular-nums">
                    {formatIDR(acc.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100">
            <Link
              href="/transfers"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
            >
              <ArrowRightLeft className="h-4 w-4 text-zinc-950" />
              Transfer Funds Between Accounts
            </Link>
          </div>
        </div>

        {/* Right: Recent Transaction Activity (8 cols) */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-zinc-950" />
                Recent Financial Activity
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Audit feed of direct expenditures, milestone billings, and team advances
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-xl bg-zinc-100 p-1 text-xs font-medium">
              {[
                { id: "all", label: "All" },
                { id: "expense", label: "Outflows" },
                { id: "income", label: "Inflows" },
                { id: "advance", label: "Advances" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTxFilter(f.id as any)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 transition-all text-xs",
                    txFilter === f.id
                      ? "bg-white text-zinc-950 font-bold shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="mt-4 divide-y divide-zinc-100 overflow-x-auto">
            {filteredTx.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Date</th>
                    <th className="pb-3">Description &amp; Payee</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredTx.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-zinc-50/80 transition-colors"
                    >
                      <td className="py-3 pl-2 font-mono text-zinc-500 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 pr-2">
                        <p className="font-semibold text-zinc-900">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {tx.merchant}
                        </p>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <Badge
                          variant={
                            tx.status === "POSTED" || tx.status === "PAID"
                              ? "success"
                              : tx.status === "APPROVED"
                              ? "info"
                              : "warning"
                          }
                          size="sm"
                          dot
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "py-3 pr-2 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                          tx.type === "income"
                            ? "text-emerald-700"
                            : "text-zinc-900"
                        )}
                      >
                        {tx.type === "income" ? "+" : "-"} {formatIDR(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-zinc-400">
                <Receipt className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p>No transactions found for this filter</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Displaying {filteredTx.length} latest entries
            </span>
            <Link
              href="/expenses"
              className="font-semibold text-zinc-900 hover:underline flex items-center gap-1"
            >
              View Full General Expense Ledger
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
