import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` : merge conditional class names and de-duplicate conflicting Tailwind
 * utilities. Standard shadcn/ui helper; used by every UI component so that
 * dropping in official shadcn/Origin UI/Tremor components works unchanged.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
