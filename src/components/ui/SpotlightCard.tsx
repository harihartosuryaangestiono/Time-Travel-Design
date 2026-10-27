"use client";

import type { CSSProperties, HTMLAttributes, PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

type SpotlightStyle = CSSProperties & {
  "--spotlight-color": string;
};

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgb(16 185 129 / 0.11)",
  onPointerMove,
  onPointerLeave,
  ...props
}: SpotlightCardProps) {
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
    onPointerMove?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--spotlight-x");
    event.currentTarget.style.removeProperty("--spotlight-y");
    onPointerLeave?.(event);
  };

  return (
    <div
      {...props}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ "--spotlight-color": spotlightColor, ...props.style } as SpotlightStyle}
      className={cn("dashboard-spotlight-card", className)}
    >
      {children}
    </div>
  );
}
