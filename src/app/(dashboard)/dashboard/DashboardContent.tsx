"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Building2,
  FolderKanban,
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
import { motion, useInView, useReducedMotion } from "framer-motion";
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
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { BrandIconSvg } from "@/components/ui/BrandLogo";
import { PulseDot } from "@/components/ui/PulseDot";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { cn } from "@/lib/utils";
import {
  getDashboardMetrics,
  getIncomeVsExpense,
  getExpensesByCategory,
  getProjectBudgetSummary,
  getRecentTransactions,
  DashboardMetrics,
} from "@/app/actions/dashboardActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";

// Format currency in Rupiah
function formatIDR(amount: number) {
  if (isNaN(amount)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format short currency (e.g. 1.2 B, 450 M)
function formatShortIDR(amount: number) {
  if (isNaN(amount)) return "0";
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

function formatPercent(value: number, original: string) {
  const decimalPart = original.split(/[.,]/)[1];
  const decimalPlaces = decimalPart ? decimalPart.replace(/\D/g, "").length : 0;
  return `${value.toFixed(decimalPlaces)}%`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardContent() {
  const reducedMotion = useReducedMotion();
  const analyticsRef = useRef<HTMLDivElement>(null);
  const analyticsInView = useInView(analyticsRef, { once: true, margin: "100px 0px" });
  const [period, setPeriod] = useState("ytd");
  const [chartView, setChartView] = useState<"flow" | "margin">("flow");
  const [isLoading, setIsLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<"all" | "expense">("all");

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_cash: 0,
    total_income: 0,
    total_expenses: 0,
    net_profit: 0,
    profit_margin: 0,
    outstanding_receivables: 0,
    outstanding_payables: 0,
    outstanding_cash_advances: 0,
    overdue_invoices: 0,
    accounts_count: 0,
    cash_runway_months: 0,
    quick_ratio: null,
  });

  const [accounts, setAccounts] = useState<
    { name: string; balance: number; number: string }[]
  >([]);

  const [trendData, setTrendData] = useState<
    { month: string; income: number; expense: number; profit: number; margin: number }[]
  >([]);

  const [expenseCategories, setExpenseCategories] = useState<
    { name: string; value: number; color: string; percent: string }[]
  >([]);

  const [projects, setProjects] = useState<
    {
      id: string;
      code: string;
      name: string;
      contract: number;
      spent: number;
      committed: number;
      remaining: number;
      status: string;
    }[]
  >([]);

  const [recentTx, setRecentTx] = useState<
    {
      id: string;
      date: string;
      description: string;
      category: string;
      merchant: string;
      amount: number;
      type: "expense";
      status: string;
    }[]
  >([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Hitung rentang tanggal sesuai tab period
      const now = new Date();
      let startDate: string;
      const endDate = formatLocalDate(now);

      if (period === "this_month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = formatLocalDate(start);
      } else if (period === "last_quarter") {
        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        startDate = formatLocalDate(start);
      } else {
        const start = new Date(now.getFullYear(), 0, 1);
        startDate = formatLocalDate(start);
      }

      // Ambil metrik ringkasan
      const [metricsRes, trendRes, catRes, projectsRes, txRes, cashAccounts] = await Promise.all([
        getDashboardMetrics({ start_date: startDate, end_date: endDate }),
        getIncomeVsExpense(
          period === "ytd" ? now.getMonth() + 1 : period === "last_quarter" ? 3 : 6
        ),
        getExpensesByCategory(startDate, endDate),
        getProjectBudgetSummary(5),
        getRecentTransactions(8),
        getCashAccountsWithBalances(),
      ]);

      setMetrics(metricsRes);
      setTrendData(trendRes);
      setExpenseCategories(catRes);
      setProjects(projectsRes);
      setRecentTx(txRes);

      setAccounts(
        cashAccounts.map((account) => ({
          name: account.name,
          balance: account.current_balance,
          number: account.account_number ? `•••• ${account.account_number.slice(-4)}` : "Kas Tunai",
        }))
      );
    } catch (e) {
      console.error("Gagal memuat analitik dashboard:", e);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const filteredTx = recentTx.filter((t) => {
    if (txFilter === "all") return true;
    return t.type === txFilter;
  });

  // Hitung rata-rata bulanan dari data 6 bulan
  const avgInflow =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, t) => s + t.income, 0) / trendData.length)
      : 0;
  const avgBurn =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, t) => s + t.expense, 0) / trendData.length)
      : 0;
  const avgProfit =
    trendData.length > 0
      ? Math.round(trendData.reduce((s, t) => s + t.profit, 0) / trendData.length)
      : 0;

  // Persentase serapan anggaran proyek aktif
  const totalContractProjects = projects.reduce((s, p) => s + p.contract, 0);
  const totalSpentProjects = projects.reduce((s, p) => s + p.spent, 0);
  const avgAbsorption =
    totalContractProjects > 0
      ? Math.round((totalSpentProjects / totalContractProjects) * 100)
      : 0;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* ── Top Bar: Welcome & Financial Context ── */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <SpotlightCard className="dashboard-hero flex flex-col gap-5 rounded-3xl border border-white/10 p-6 text-white shadow-2xl sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="dashboard-hero-orb" aria-hidden="true" />
          <div className="dashboard-hero-grain" aria-hidden="true" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-inner backdrop-blur sm:flex">
              <BrandIconSvg fill="#FFFFFF" className="dashboard-logo-shimmer h-6 w-auto" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
                  <PulseDot />
                  Live Financial Intelligence
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
                  TIME TRAVEL DESIGN
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Financial Performance &amp; Cash Flow Overview
              </h2>
              <p className="max-w-2xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                Pemantauan arus kas, biaya proyek, dan likuiditas kas operasional
                secara langsung dari transaksi pembukuan.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2.5">
            {/* Period Selector */}
            <div className="flex items-center rounded-xl border border-white/10 bg-black/25 p-1 text-xs font-medium text-zinc-300 backdrop-blur">
              {[
                { id: "this_month", label: "Bulan Ini" },
                { id: "last_quarter", label: "3 Bulan" },
                { id: "ytd", label: "Tahun Ini" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "relative rounded-lg px-3 py-1.5 transition-colors duration-200",
                    period === p.id
                      ? "font-bold text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {period === p.id && (
                    <motion.span
                      layoutId="dashboard-period-indicator"
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 34 }
                      }
                    />
                  )}
                  <span className="relative z-10">{p.label}</span>
                </button>
              ))}
            </div>

            <motion.button
              whileHover={reducedMotion ? undefined : { y: -2 }}
              whileTap={reducedMotion ? undefined : { scale: 0.94 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => fetchDashboardData()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Muat ulang data"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </motion.button>
          </div>
        </SpotlightCard>
      </motion.div>

      {/* ── Executive Financial Vitality Strip ── */}
      <StaggerContainer
        key={`vitality-${period}`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4"
      >
        <StaggerItem>
          <SpotlightCard className="dashboard-card dashboard-kpi-card group relative p-4">
            <div className="mb-1 flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs">Cash Runway</span>
              <Flame className="dashboard-kpi-icon h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-zinc-950 tabular-nums">
              {isLoading ? (
                <span className="dashboard-skeleton inline-block h-6 w-24 rounded-md align-middle" aria-label="Memuat" />
              ) : metrics.cash_runway_months > 0 ? (
                <AnimatedNumber
                  value={metrics.cash_runway_months}
                  format={(number) => `${Number(number.toFixed(1))} Bulan`}
                />
              ) : "—"}
            </div>
            <p className="mt-1 text-[11px] font-medium text-zinc-500">
              {metrics.cash_runway_months >= 6
                ? "Likuiditas mencukupi (> 6 bulan)"
                : metrics.cash_runway_months > 0
                ? "Perlu percepatan penagihan"
                : "Belum ada pengeluaran"}
            </p>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="dashboard-card dashboard-kpi-card group relative p-4">
            <div className="mb-1 flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs">Net Profit Margin</span>
              <Zap className="dashboard-kpi-icon h-4 w-4 text-emerald-600" />
            </div>
            <div className={cn("text-xl font-bold tracking-tight tabular-nums", metrics.profit_margin >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {isLoading ? (
                <span className="dashboard-skeleton inline-block h-6 w-20 rounded-md align-middle" aria-label="Memuat" />
              ) : (
                <AnimatedNumber
                  value={metrics.profit_margin}
                  format={(number) => `${Number(number.toFixed(1))}%`}
                />
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {metrics.total_income > 0 ? "Berdasarkan invoice terbayar" : "Belum ada pemasukan"}
            </p>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="dashboard-card dashboard-kpi-card group relative p-4">
            <div className="mb-1 flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs">Rasio Likuiditas Cepat</span>
              <ShieldCheck className="dashboard-kpi-icon h-4 w-4 text-sky-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-zinc-950 tabular-nums">
              {isLoading ? (
                <span className="dashboard-skeleton inline-block h-6 w-20 rounded-md align-middle" aria-label="Memuat" />
              ) : metrics.quick_ratio !== null ? (
                <AnimatedNumber
                  value={metrics.quick_ratio}
                  format={(number) => `${Number(number.toFixed(1))}x`}
                />
              ) : metrics.total_cash > 0 ? "Likuid" : "—"}
            </div>
            <p className="mt-1 text-[11px] font-medium text-zinc-500">
              (Kas + Piutang) vs Kewajiban
            </p>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="dashboard-card dashboard-kpi-card group relative p-4">
            <div className="mb-1 flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs">Serapan Biaya Proyek</span>
              <BarChart3 className="dashboard-kpi-icon h-4 w-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-zinc-950 tabular-nums">
              {isLoading ? (
                <span className="dashboard-skeleton inline-block h-6 w-20 rounded-md align-middle" aria-label="Memuat" />
              ) : (
                <AnimatedNumber value={avgAbsorption} format={(number) => `${Math.round(number)}%`} />
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Realisasi biaya vs nilai kontrak
            </p>
          </SpotlightCard>
        </StaggerItem>
      </StaggerContainer>

      {/* ── 6 Core Financial KPI Cards ── */}
      <StaggerContainer
        key={`financial-${period}`}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* Total Cash & Bank */}
        <StaggerItem><StatCard
          title="Total Kas &amp; Bank"
          value={isLoading ? "..." : formatIDR(metrics.total_cash)}
          subtitle={`${accounts.length} rekening aktif terdata`}
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          badge="Kas Riil"
          gradient
        /></StaggerItem>

        {/* Total Inflow / Pendapatan */}
        <StaggerItem><StatCard
          title="Pemasukan Terbayar"
          value={isLoading ? "..." : formatIDR(metrics.total_income)}
          subtitle="Penerimaan invoice periode ini"
          icon={ArrowDownRight}
          iconBgColor="bg-teal-500/10"
          iconColor="text-teal-700"
        /></StaggerItem>

        {/* Total Outflow / Pengeluaran */}
        <StaggerItem><StatCard
          title="Total Pengeluaran"
          value={isLoading ? "..." : formatIDR(metrics.total_expenses)}
          subtitle="Biaya operasional &amp; proyek"
          icon={Receipt}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        /></StaggerItem>

        {/* Laba Bersih */}
        <StaggerItem><StatCard
          title="Laba Bersih Operasional"
          value={isLoading ? "..." : formatIDR(metrics.net_profit)}
          subtitle={`Margin bersih ${metrics.profit_margin}%`}
          icon={TrendingUp}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        /></StaggerItem>

        {/* Piutang Tertagih */}
        <StaggerItem><StatCard
          title="Piutang Usaha (A/R)"
          value={isLoading ? "..." : formatIDR(metrics.outstanding_receivables)}
          subtitle={
            metrics.overdue_invoices > 0
              ? `${metrics.overdue_invoices} invoice jatuh tempo`
              : "Belum lunas dari klien"
          }
          icon={FileText}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        /></StaggerItem>

        {/* Hutang & Kasbon Berjalan */}
        <StaggerItem><StatCard
          title="Kewajiban &amp; Kasbon Berjalan"
          value={
            isLoading
              ? "..."
              : formatIDR(
                  metrics.outstanding_payables + metrics.outstanding_cash_advances
                )
          }
          subtitle={`Kasbon terbuka: ${formatIDR(metrics.outstanding_cash_advances)}`}
          icon={Coins}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        /></StaggerItem>
      </StaggerContainer>

      {/* ── Deep Analytics Section (Charts) ── */}
      <div ref={analyticsRef} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Chart: Cash Flow & Trends (7 cols) */}
        <SpotlightCard className="dashboard-card dashboard-analytics-card p-6 lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-zinc-950" />
                Dinamika Arus Kas &amp; Pertumbuhan Laba
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Perbandingan riil pemasukan vs pengeluaran 6 bulan terakhir
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex items-center rounded-xl border border-zinc-200/70 bg-zinc-100/80 p-1 text-xs font-medium">
              <button
                onClick={() => setChartView("flow")}
                className={cn(
                  "relative rounded-lg px-2.5 py-1 transition-colors",
                  chartView === "flow"
                    ? "font-bold text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {chartView === "flow" && (
                  <motion.span
                    layoutId="dashboard-chart-indicator"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
                <span className="relative z-10">Pemasukan vs Biaya</span>
              </button>
              <button
                onClick={() => setChartView("margin")}
                className={cn(
                  "relative rounded-lg px-2.5 py-1 transition-colors",
                  chartView === "margin"
                    ? "font-bold text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {chartView === "margin" && (
                  <motion.span
                    layoutId="dashboard-chart-indicator"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
                <span className="relative z-10">Laba Bersih</span>
              </button>
            </div>
          </div>

          <div className="mt-6 h-72 sm:h-80 w-full">
            {isLoading || !analyticsInView ? (
              <div className="dashboard-skeleton h-full w-full rounded-2xl" />
            ) : trendData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-400">
                <BarChart3 className="h-10 w-10 text-zinc-300 mb-2" />
                <p className="text-xs">Belum ada riwayat transaksi bulanan</p>
              </div>
            ) : (
              <motion.div
                key={chartView}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full"
              >
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
                            <div className="dashboard-chart-tooltip rounded-xl border border-zinc-200 bg-white p-3 text-xs">
                              <p className="font-bold text-zinc-900">{label}</p>
                              <p className="text-emerald-700 font-semibold">
                                Pemasukan: <AnimatedNumber value={Number(payload[0]?.value || 0)} format={formatIDR} />
                              </p>
                              <p className="text-rose-600 font-semibold">
                                Pengeluaran: <AnimatedNumber value={Number(payload[1]?.value || 0)} format={formatIDR} />
                              </p>
                              <p className="text-zinc-500 pt-1 border-t border-zinc-100">
                                Laba Bersih:{" "}
                                <AnimatedNumber
                                  value={Number(payload[0]?.value || 0) - Number(payload[1]?.value || 0)}
                                  format={formatIDR}
                                />
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
                      name="Pemasukan"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                      isAnimationActive={!reducedMotion}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Pengeluaran"
                      stroke="#F43F5E"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                      isAnimationActive={!reducedMotion}
                      animationDuration={1200}
                      animationEasing="ease-out"
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
                            <div className="dashboard-chart-tooltip rounded-xl border border-zinc-200 bg-white p-3 text-xs">
                              <p className="font-bold text-zinc-900">{label}</p>
                              <p className="text-emerald-700 font-semibold">
                                Laba Bersih: <AnimatedNumber value={Number(payload[0]?.value || 0)} format={formatIDR} />
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="profit"
                      name="Laba Bersih"
                      fill="#18181B"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={!reducedMotion}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
              </motion.div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-50 p-3 text-center text-xs">
            <div>
              <span className="text-zinc-500">Rata-rata Pemasukan</span>
              <p className="font-bold text-zinc-900 mt-0.5">
                <AnimatedNumber value={avgInflow} format={formatShortIDR} /> / bln
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Rata-rata Pengeluaran</span>
              <p className="font-bold text-rose-600 mt-0.5">
                <AnimatedNumber value={avgBurn} format={formatShortIDR} /> / bln
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Rata-rata Laba</span>
              <p className="font-bold text-emerald-700 mt-0.5">
                <AnimatedNumber value={avgProfit} format={formatShortIDR} /> / bln
              </p>
            </div>
          </div>
        </SpotlightCard>

        {/* Expense Category Breakdown (5 cols) */}
        <SpotlightCard className="dashboard-card dashboard-analytics-card flex flex-col justify-between p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <PieIcon className="h-5 w-5 text-zinc-950" />
                  Alokasi Pengeluaran
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Distribusi pos biaya proyek &amp; studio
                </p>
              </div>
              <Badge variant="neutral">Data Riil</Badge>
            </div>

            <div className="mt-4 h-52 w-full flex items-center justify-center">
              {isLoading || !analyticsInView ? (
                <div className="dashboard-skeleton h-32 w-32 rounded-full" />
              ) : expenseCategories.length === 0 ? (
                <div className="text-center text-zinc-400 text-xs">
                  <PieIcon className="h-8 w-8 mx-auto text-zinc-300 mb-1" />
                  Belum ada kategori pengeluaran terdata
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={!reducedMotion}
                      animationDuration={1000}
                      animationEasing="ease-out"
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
                            <div className="dashboard-chart-tooltip rounded-xl border border-zinc-200 bg-white p-2.5 text-xs">
                              <p className="font-bold text-zinc-900">{data.name}</p>
                              <p className="text-zinc-900 font-semibold mt-0.5">
                                <AnimatedNumber value={data.value} format={formatIDR} /> ({data.percent})
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category List */}
          <div className="space-y-2 mt-2">
            {expenseCategories.length > 0 ? (
              expenseCategories.slice(0, 4).map((cat) => (
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
                      <AnimatedNumber value={cat.value} format={formatShortIDR} />
                    </span>
                    <span className="text-zinc-400 ml-1.5 text-[10px]">
                      ({Number.isFinite(Number(cat.percent.replace("%", ""))) ? (
                        <AnimatedNumber
                          key={`${period}-${cat.name}`}
                          value={Number(cat.percent.replace("%", ""))}
                          format={(number) => formatPercent(number, cat.percent)}
                        />
                      ) : cat.percent})
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-zinc-400 py-3">
                Kategori akan muncul setelah ada pengeluaran tersimpan
              </p>
            )}
          </div>
        </SpotlightCard>
      </div>

      {/* ── Project Budget Realization Matrix ── */}
      <div className="dashboard-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-zinc-950" />
              Realisasi Anggaran Proyek
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Monitoring serapan biaya material dan operasional proyek
            </p>
          </div>
          <Link
            href="/projects"
            className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1"
          >
            Lihat Semua Proyek ({projects.length})
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="dashboard-skeleton h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              <FolderKanban className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs">Belum ada proyek aktif terdata</p>
            </div>
          ) : (
            projects.map((prj) => {
              const consumedPercent =
                prj.contract > 0
                  ? Math.min(100, Math.round((prj.spent / prj.contract) * 100))
                  : 0;

              return (
                <div
                  key={prj.id}
                  className="dashboard-card dashboard-project-row p-4 bg-zinc-50/50"
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
                        <Badge variant="neutral" size="sm">
                          {prj.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                          Nilai Kontrak
                        </span>
                        <p className="font-bold text-zinc-900 tabular-nums">
                          <AnimatedNumber key={`${period}-${prj.id}-contract`} value={prj.contract} format={formatIDR} />
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                          Biaya Terserap
                        </span>
                        <p className="font-bold text-rose-600 tabular-nums">
                          <AnimatedNumber key={`${period}-${prj.id}-spent`} value={prj.spent} format={formatIDR} />
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-zinc-400 font-semibold">
                          Sisa Anggaran
                        </span>
                        <p className="font-bold text-emerald-700 tabular-nums">
                          <AnimatedNumber key={`${period}-${prj.id}-remaining`} value={prj.remaining} format={formatIDR} />
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                      <span>Serapan Biaya</span>
                      <span><AnimatedNumber key={`${period}-${prj.id}-absorption`} value={consumedPercent} format={(number) => `${Math.round(number)}%`} /> teralokasi</span>
                    </div>
                    <ProgressBar
                      value={consumedPercent}
                      size="sm"
                      variant={consumedPercent > 80 ? "amber" : "emerald"}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Bottom Grid: Cash Accounts & Recent Transactions Feed ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Liquid Accounts Overview (4 cols) */}
        <div className="dashboard-card p-6 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-zinc-950" />
                  Rekening Kas &amp; Bank
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Saldo riil rekening operasional perusahaan
                </p>
              </div>
              <Link
                href="/cash-accounts"
                className="text-xs font-semibold text-zinc-900 hover:underline"
              >
                Kelola
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="dashboard-skeleton h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-center text-xs text-zinc-400 py-6">
                  Belum ada rekening kas aktif
                </p>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.name}
                    className="dashboard-card dashboard-project-row p-4 bg-zinc-50/50"
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
                        Aktif
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-zinc-950 tabular-nums">
                      <AnimatedNumber key={`${period}-${acc.name}`} value={acc.balance} format={formatIDR} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right: Recent Transaction Activity (8 cols) */}
        <div className="dashboard-card p-6 lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-zinc-950" />
                Aktivitas Keuangan Terbaru
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Catatan pengeluaran riil dan pembayaran proyek
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-xl border border-zinc-200/70 bg-zinc-100/80 p-1 text-xs font-medium">
              {[
                { id: "all", label: "Semua" },
                { id: "expense", label: "Pengeluaran" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTxFilter(f.id as any)}
                  className={cn(
                    "relative rounded-lg px-2.5 py-1 transition-colors text-xs",
                    txFilter === f.id
                      ? "font-bold text-zinc-950"
                      : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  {txFilter === f.id && (
                    <motion.span
                      layoutId="dashboard-transaction-filter-indicator"
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 34 }
                      }
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="mt-4 divide-y divide-zinc-100 overflow-x-auto">
            {isLoading ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="dashboard-skeleton h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredTx.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Tanggal</th>
                    <th className="pb-3">Keterangan &amp; Merchant</th>
                    <th className="pb-3">Kategori</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Nominal</th>
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
                            tx.status === "POSTED"
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
                      <td className="py-3 pr-2 text-right font-mono font-bold tabular-nums whitespace-nowrap text-zinc-900">
                        - <AnimatedNumber key={`${period}-${tx.id}`} value={tx.amount} format={formatIDR} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-zinc-400">
                <Receipt className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p>Belum ada transaksi pengeluaran tercatat</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Menampilkan {filteredTx.length} transaksi terbaru
            </span>
            <Link
              href="/cash-book"
              className="font-semibold text-zinc-900 hover:underline flex items-center gap-1"
            >
              Buka Buku Kas Perusahaan
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
