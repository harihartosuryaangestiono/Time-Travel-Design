"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format,
  duration = 1.2,
  className,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const formattedValue = useTransform(motionValue, (current) => format(current));

  useEffect(() => {
    if (reducedMotion) {
      motionValue.set(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [1, 0, 0.2, 1],
    });
    return () => controls.stop();
  }, [duration, motionValue, reducedMotion, value]);

  return <motion.span className={className}>{formattedValue}</motion.span>;
}
