"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarView } from "@/lib/config/booking-calendar";
import { CalendarAvailabilityCache } from "@/lib/helpers/calendar-cache";
import { addDaysToDateKey, isDateKey } from "@/lib/helpers/datetime";
export const CALENDAR_CHANGE_EVENT = "navi:calendar-availability-change";
const cache = new CalendarAvailabilityCache();
async function load(month: string, date: string | null) {
  return cache.load(month, date, async () => {
    const params = new URLSearchParams({ month });
    if (date) params.set("date", date);
    const response = await fetch(`/api/availability/calendar?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("availability_unavailable");
    const result = (await response.json()) as CalendarView;
    if (
      result.source !== "live" ||
      !Array.isArray(result.days) ||
      !Array.isArray(result.selectedSlots)
    )
      throw new Error("availability_unavailable");
    return result;
  });
}
export function useCalendarAvailability(initial: CalendarView) {
  const [view, setView] = useState(initial);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const current = useRef({
    month: initial.monthKey,
    date: initial.selectedDateKey,
  });
  const refresh = useCallback(async (month: string, date: string | null) => {
    const token = ++sequence.current;
    current.current = { month, date };
    const cached = cache.peek(month, date);
    // Highlight the requested day on the same event; never retain another day's times.
    setView(
      (previous) =>
        cached ?? {
          ...previous,
          monthKey: month,
          selectedDateKey: date,
          selectedSlots: [],
          source: previous.source === "preview" ? "preview" : "live",
        },
    );
    setLoading(!cached);
    try {
      const result = cached ?? (await load(month, date));
      if (mounted.current && token === sequence.current) setView(result);
    } catch {
      if (mounted.current && token === sequence.current)
        setView((previous) => ({
          ...previous,
          source: "unavailable",
          selectedSlots: [],
        }));
    } finally {
      if (mounted.current && token === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    sequence.current++;
    cache.seed(initial);
    const invalidate = () => {
      cache.invalidate();
      void refresh(current.current.month, current.current.date);
    };
    const pop = () => {
      const params = new URLSearchParams(window.location.search),
        date = params.get("date"),
        month = params.get("month");
      const safeDate = date && isDateKey(date) ? date : null;
      const safeMonth =
        safeDate?.slice(0, 7) ??
        (month && /^\d{4}-\d{2}$/.test(month) && isDateKey(`${month}-01`)
          ? month
          : initial.minDateKey.slice(0, 7));
      void refresh(safeMonth, safeDate);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    window.addEventListener("popstate", pop);
    window.addEventListener(CALENDAR_CHANGE_EVENT, invalidate);
    window.addEventListener("focus", invalidate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", pop);
      window.removeEventListener(CALENDAR_CHANGE_EVENT, invalidate);
      window.removeEventListener("focus", invalidate);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // The server snapshot seeds this mounted calendar once. Navigation is local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);
  useEffect(() => {
    if (loading || view.source !== "live" || !view.selectedDateKey) return;
    const date = view.selectedDateKey;
    const timer = window.setTimeout(() => {
      for (const delta of [-1, 1]) {
        const neighbor = addDaysToDateKey(date, delta);
        if (neighbor >= view.minDateKey && neighbor <= view.maxDateKey)
          void load(neighbor.slice(0, 7), neighbor).catch(() => {});
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    view.selectedDateKey,
    view.minDateKey,
    view.maxDateKey,
    view.source,
    loading,
  ]);
  return { view, loading, refresh };
}
