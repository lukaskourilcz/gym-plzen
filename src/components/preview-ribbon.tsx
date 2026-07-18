import { Eye } from "lucide-react";
import { isPreviewMode } from "@/lib/preview";

/**
 * Site-wide "Náhled" pill (rendered from the root layout), visible on every
 * page while client-preview mode is active — so nobody mistakes demo data or
 * the open administration for the real thing. Renders nothing otherwise.
 */
export function PreviewRibbon() {
  if (!isPreviewMode()) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50/95 px-4 py-1.5 text-xs font-medium text-amber-900 shadow-lg backdrop-blur dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-200">
        <Eye className="size-3.5" />
        Náhled pro klienta — bez přihlášení, ukázková data
      </div>
    </div>
  );
}
