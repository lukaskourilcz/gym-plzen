"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DesignVariantSwitch } from "@/components/site/design-variant-switch";
import {
  readDesignPreviewFromCookies,
  serialiseDesignPreviewCookie,
} from "@/lib/config/design-variant";

/**
 * Unlocks the design switch for this browser. Opening `/dev` is the whole
 * gesture: arriving here turns the preview on, so the switch appears in the
 * header on every page from then on. Visitors who never type this address see
 * no control at all.
 *
 * Turning it off again expires the cookie, which is why the page keeps an
 * explicit off button rather than relying on the browser being cleared.
 */
export function PreviewToggle() {
  const [enabled, setEnabled] = useState(false);

  const apply = useCallback((next: boolean) => {
    document.cookie = serialiseDesignPreviewCookie(
      next,
      window.location.protocol === "https:",
    );
    if (next) {
      document.documentElement.dataset.preview = "on";
    } else {
      delete document.documentElement.dataset.preview;
    }
    setEnabled(next);
  }, []);

  // Arriving on this page is what enables the preview.
  useEffect(() => {
    if (readDesignPreviewFromCookies(document.cookie)) {
      setEnabled(true);
      return;
    }
    apply(true);
  }, [apply]);

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-6">
      <p
        className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground"
        role="status"
      >
        {enabled ? "Náhled je zapnutý" : "Náhled je vypnutý"}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {enabled
          ? "Přepínač vzhledu se teď zobrazuje v hlavičce na všech stránkách, jen ve vašem prohlížeči. Návštěvníci ho nevidí."
          : "Přepínač je skrytý. Zapnutím se znovu zobrazí v hlavičce, jen ve vašem prohlížeči."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {/*
         * The same control as in the header. It is not wrapped in the preview
         * gate, so it stays usable on this page even while the preview is off.
         */}
        <DesignVariantSwitch />
        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          onClick={() => apply(!enabled)}
        >
          {enabled ? "Vypnout náhled" : "Zapnout náhled"}
        </Button>
      </div>
    </div>
  );
}
