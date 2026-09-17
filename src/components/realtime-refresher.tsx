"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";
import { PUBLIC_AVAILABILITY_TABLE } from "@/lib/config/realtime";

/**
 * Live-calendar realtime: subscribes to Postgres changes on a table via Supabase
 * Realtime and calls `router.refresh()` when anything changes, so a slot that
 * someone books disappears for everyone instantly without a manual reload.
 *
 * We deliberately ignore the change payload and just re-fetch on the server :
 * that way no reservation PII is trusted from the realtime channel; the server
 * re-render returns only availability. Renders nothing.
 *
 * The Supabase browser client is ~70 KB gzipped and nothing on the page needs
 * it to render, so it is fetched as its own chunk once the browser is idle,
 * after hydration, rather than on the critical path of the calendar.
 *
 * No-ops (renders nothing, subscribes to nothing) when Supabase realtime isn't
 * configured, so the page still works without it.
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !supabasePublicKey) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;
    const subscribe = () => {
      void import("@/lib/supabase/client").then(({ createClient }) => {
        if (cancelled) return;
        const supabase = createClient();
        if (!supabase) return;
        const channel = supabase
          .channel("public-availability")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: PUBLIC_AVAILABILITY_TABLE },
            () => router.refresh(),
          )
          .subscribe();
        teardown = () => {
          void supabase.removeChannel(channel);
        };
      });
    };

    // Safari has no requestIdleCallback; a macrotask after hydration will do.
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(subscribe)
        : window.setTimeout(subscribe, 1);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle);
      } else {
        window.clearTimeout(idle);
      }
      teardown?.();
    };
  }, [router]);

  return null;
}
