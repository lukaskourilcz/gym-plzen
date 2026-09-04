"use client";

import { useEffect, useState } from "react";
import { DesignVariantSwitch } from "@/components/site/design-variant-switch";
import {
  DESIGN_VARIANT_LABELS,
  DEFAULT_DESIGN_VARIANT,
  type DesignVariant,
  readDesignVariantFromCookies,
} from "@/lib/config/design-variant";

/**
 * The only place the Klasický / Moderní switch exists. The rest of the site
 * simply renders whichever look this browser has chosen, so a visitor never
 * meets the control : not in the header, not in the mobile menu, not at any
 * width.
 *
 * The choice is a cookie, so it survives closing the window and affects nobody
 * else's browser.
 */
const SYNC_EVENT = "namaste:design-variant";

export function VariantPicker() {
  // Server-rendered markup stays variant-neutral (public pages are ISR), so
  // the real choice is adopted from the DOM after mount.
  const [variant, setVariant] = useState<DesignVariant>(DEFAULT_DESIGN_VARIANT);

  useEffect(() => {
    const read = () =>
      setVariant(
        (document.documentElement.dataset.design as
          DesignVariant | undefined) ??
          readDesignVariantFromCookies(document.cookie),
      );
    read();
    window.addEventListener(SYNC_EVENT, read);
    return () => window.removeEventListener(SYNC_EVENT, read);
  }, []);

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-6">
      <p
        className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground"
        role="status"
      >
        Nastaveno: {DESIGN_VARIANT_LABELS[variant]}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Vyberte podobu a projděte si web v dalších záložkách. Přepínač zůstává
        jen tady, takže návštěvníci ho nikde nepotkají.
      </p>

      <div className="mt-6">
        <DesignVariantSwitch />
      </div>
    </div>
  );
}
