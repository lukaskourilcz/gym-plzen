"use client";

import { useLayoutEffect } from "react";

/**
 * The confirmation token proves a guest's booking. It arrives in the address
 * from the payment gateway, where analytics would otherwise report it as part
 * of the page URL. The page has already been rendered from it, so it is taken
 * out of the address bar before any page view can be measured; the links on
 * the page that still need it carry their own copy.
 */
export function StripUrlToken() {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);
  return null;
}
