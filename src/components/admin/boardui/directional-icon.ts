import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

/** BoardUI's directional glyph helper, adapted to NAVI's existing icon set. */
const directionalIcons: ReadonlySet<unknown> = new Set([
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
]);

export function directionalIconClass(icon: unknown): string | undefined {
  return directionalIcons.has(icon) ? "rtl:rotate-180" : undefined;
}
