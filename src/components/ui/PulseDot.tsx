"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PulseDot({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      className={cn("inline-block h-1.5 w-1.5 rounded-full bg-emerald-400", className)}
      animate={reducedMotion ? undefined : { opacity: [1, 0.55, 1], scale: [1, 1.18, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
