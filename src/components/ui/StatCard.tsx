import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isGood?: boolean; // e.g. for expenses, down is good
  };
  icon: React.ElementType;
  iconBgColor?: string;
  iconColor?: string;
  gradient?: boolean;
  className?: string;
  compactValue?: boolean;
  badge?: string;
  onClick?: () => void;
}

function formatCurrencyAmount(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseFormattedCurrency(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconBgColor = "bg-zinc-100",
  iconColor = "text-zinc-900",
  gradient = false,
  className,
  compactValue = false,
  badge,
  onClick,
}: StatCardProps) {
  const isGood = trend?.isGood ?? trend?.isPositive;
  const isCurrencyValue = /^-?Rp/.test(value.trim());
  const numericValue = isCurrencyValue
    ? parseFormattedCurrency(value)
    : Number.NaN;
  const currencyInSubtitle = subtitle?.match(/-?Rp[\s\u00a0]*[\d.,]+/);
  const percentInSubtitle = currencyInSubtitle ? null : subtitle?.match(/-?\d+(?:[.,]\d+)?%/);
  const currencySubtitleIndex = currencyInSubtitle?.index ?? 0;
  const percentSubtitleIndex = percentInSubtitle?.index ?? 0;
  const subtitleCurrencyValue = currencyInSubtitle
    ? parseFormattedCurrency(currencyInSubtitle[0])
    : Number.NaN;
  const subtitlePercentValue = percentInSubtitle
    ? Number(percentInSubtitle[0].replace("%", "").replace(",", "."))
    : Number.NaN;
  const valueContent = isCurrencyValue && Number.isFinite(numericValue) ? (
    <AnimatedNumber value={numericValue} format={formatCurrencyAmount} />
  ) : value === "..." ? (
    <span className="dashboard-skeleton inline-block h-7 w-36 max-w-full rounded-lg align-middle" aria-label="Memuat" />
  ) : (
    value
  );

  return (
    <SpotlightCard
      onClick={onClick}
      className={cn(
        "dashboard-card group relative p-5",
        gradient && "bg-gradient-to-br from-white via-white to-zinc-50/80",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 break-words text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {title}
            </span>
            {badge && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase">
                {badge}
              </span>
            )}
          </div>
          {!compactValue && (
            <div className="break-words text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">
              {valueContent}
            </div>
          )}
        </div>

        <div
          className={cn(
            "dashboard-stat-icon flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
            iconBgColor
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>

      {compactValue && (
        <div className="mt-2 whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 tabular-nums">
          {valueContent}
        </div>
      )}

      {(subtitle || trend) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                isGood
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : trend.isPositive === false ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-500 font-normal truncate">
              {currencyInSubtitle && Number.isFinite(subtitleCurrencyValue) ? (
                <>
                  {subtitle.slice(0, currencySubtitleIndex)}
                  <AnimatedNumber value={subtitleCurrencyValue} format={formatCurrencyAmount} />
                  {subtitle.slice(currencySubtitleIndex + currencyInSubtitle[0].length)}
                </>
              ) : percentInSubtitle && Number.isFinite(subtitlePercentValue) ? (
                <>
                  {subtitle.slice(0, percentSubtitleIndex)}
                  <AnimatedNumber
                    value={subtitlePercentValue}
                    format={(amount) => `${Number(amount.toFixed(1))}%`}
                  />
                  {subtitle.slice(percentSubtitleIndex + percentInSubtitle[0].length)}
                </>
              ) : (
                subtitle
              )}
            </span>
          )}
        </div>
      )}
    </SpotlightCard>
  );
}
