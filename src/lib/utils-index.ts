import { type ClassValue, clsx } from "clsx";
import { twMerge as tw } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return tw(clsx(inputs));
}
