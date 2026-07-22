"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
 * No-ops (renders nothing, subscribes to nothing) when Supabase realtime isn't
 * configured, so the page still works without it.
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
