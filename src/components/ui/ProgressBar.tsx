import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  variant?: "emerald" | "amber" | "rose" | "sky" | "indigo" | "auto";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  variant = "auto",
  size = "md",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  let resolvedVariant = variant;
  if (variant === "auto") {
    if (percentage > 90) resolvedVariant = "rose";
    else if (percentage > 75) resolvedVariant = "amber";
    else resolvedVariant = "emerald";
  }

  const barStyles = {
    emerald: "bg-gradient-to-r from-emerald-500 to-teal-400",
    amber: "bg-gradient-to-r from-amber-500 to-orange-400",
    rose: "bg-gradient-to-r from-rose-500 to-red-400",
    sky: "bg-gradient-to-r from-sky-500 to-blue-400",
    indigo: "bg-gradient-to-r from-indigo-500 to-violet-400",
  };

  const heightStyles = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-3.5",
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs font-medium text-slate-600">
          <span>Realisasi</span>
          <span>{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-slate-100",
          heightStyles[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            barStyles[resolvedVariant as keyof typeof barStyles]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
