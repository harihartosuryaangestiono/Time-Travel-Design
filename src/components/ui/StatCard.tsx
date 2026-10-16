import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

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
  badge?: string;
  onClick?: () => void;
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
  badge,
  onClick,
}: StatCardProps) {
  const isGood = trend?.isGood ?? trend?.isPositive;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200",
        "hover:border-zinc-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:translate-y-[-1px]",
        gradient && "bg-gradient-to-br from-white via-white to-zinc-50/80",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {title}
            </span>
            {badge && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase">
                {badge}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
            iconBgColor
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>

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
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
