/* eslint-disable @next/next/no-img-element */
import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "full" | "icon" | "horizontal";
  color?: "dark" | "white";
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  subtitle?: string;
}

/**
 * Pure SVG vector path representing the official geometric Double-T monogram
 * of Time Travel Design (Width: 590, Height: 346).
 */
export function BrandIconSvg({
  className,
  fill = "currentColor",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      viewBox="0 0 590 346"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-auto aspect-[590/346]", className)}
      aria-label="Time Travel Design"
    >
      {/* Left T: Horizontal bar (0..242, y=0..35) + Vertical stem (200..242, y=35..345) */}
      <path
        d="M0 0H242V345H200V35H0V0Z"
        fill={fill}
      />
      {/* Right T: Horizontal bar (278..589, y=0..35) + Center vertical stem (375..417, y=35..345) */}
      <path
        d="M278 0H589V35H417V345H375V35H278V0Z"
        fill={fill}
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "full",
  color = "dark",
  className,
  size = "md",
  subtitle = "Design",
}: BrandLogoProps) {
  const isWhite = color === "white";

  // Vector Icon Variant
  if (variant === "icon") {
    const sizeMap = {
      xs: "h-4",
      sm: "h-5",
      md: "h-7",
      lg: "h-9",
      xl: "h-12",
    };

    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", sizeMap[size], className)}>
        <BrandIconSvg
          fill={isWhite ? "#FFFFFF" : "#09090B"}
          className="h-full w-auto"
        />
      </div>
    );
  }

  // Horizontal Lockup Variant: Vector TT Icon on left + Typographic title on right
  if (variant === "horizontal") {
    return (
      <div className={cn("inline-flex items-center gap-3 select-none", className)}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border transition-all",
            isWhite
              ? "h-10 w-10 bg-zinc-900 border-zinc-800 shadow-inner"
              : "h-10 w-10 bg-zinc-950 border-zinc-900 shadow-sm"
          )}
        >
          <BrandIconSvg
            fill={isWhite ? "#FFFFFF" : "#FFFFFF"}
            className="h-5 w-auto"
          />
        </div>
        <div className="flex flex-col justify-center text-left">
          <span
            className={cn(
              "text-[13px] font-semibold tracking-[0.16em] uppercase font-sans leading-tight",
              isWhite ? "text-white" : "text-zinc-950"
            )}
          >
            Time Travel
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                "text-[10px] font-normal tracking-[0.24em] uppercase leading-none",
                isWhite ? "text-zinc-400" : "text-zinc-500"
              )}
            >
              {subtitle}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full Logo Variant: High-Res Official Graphic
  const sizeStyles = {
    xs: "h-6 w-auto",
    sm: "h-8 w-auto",
    md: "h-10 w-auto",
    lg: "h-12 w-auto",
    xl: "h-16 w-auto",
  };

  const src = isWhite
    ? "/images/logo-full-white.png"
    : "/images/logo-full-transparent.png";

  return (
    <img
      src={src}
      alt="Time Travel Design"
      className={cn(
        "object-contain select-none transition-all",
        sizeStyles[size],
        className
      )}
    />
  );
}
