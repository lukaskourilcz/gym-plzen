"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DESIGN_VARIANTS,
  DESIGN_VARIANT_LABELS,
  DEFAULT_DESIGN_VARIANT,
  type DesignVariant,
  readDesignVariantFromCookies,
  serialiseDesignVariantCookie,
} from "@/lib/config/design-variant";

/**
 * Keeps every mounted switch in sync. The header and the mobile menu each
 * render one; only one is visible at a time, but a resize must not reveal a
 * control showing a stale choice.
 */
const SYNC_EVENT = "namaste:design-variant";

/**
 * Two-state preview switch between the approved classic look and the modern
 * one. Native radios keep the group semantics and arrow-key behaviour; each
 * input is visually hidden and its sibling span carries the segmented styling
 * plus the focus ring, so the indicator stays visible on the light header.
 *
 * Writing the cookie and the `data-design` attribute is all it takes: the whole
 * visual difference lives in CSS, so nothing re-renders and no reload happens.
 */
export function DesignVariantSwitch({ className }: { className?: string }) {
  const groupName = useId();
  // Server-rendered markup must stay variant-neutral (public pages are ISR), so
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

  const choose = useCallback((next: DesignVariant) => {
    document.cookie = serialiseDesignVariantCookie(
      next,
      window.location.protocol === "https:",
    );
    document.documentElement.dataset.design = next;
    setVariant(next);
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  return (
    <fieldset
      className={cn(
        "flex items-center rounded-md border border-border p-0.5",
        className,
      )}
      data-testid="design-variant-switch"
    >
      <legend className="sr-only">Vzhled webu</legend>
      {DESIGN_VARIANTS.map((option) => (
        <label key={option} className="flex cursor-pointer items-center">
          <input
            type="radio"
            name={groupName}
            value={option}
            checked={variant === option}
            onChange={() => choose(option)}
            className="peer sr-only"
          />
          <span className="flex min-h-11 items-center rounded-sm px-3 text-[11px] font-extrabold uppercase tracking-[.1em] text-muted-foreground transition-colors duration-[140ms] ease-brand peer-checked:bg-ink peer-checked:text-ink-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
            {DESIGN_VARIANT_LABELS[option]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
