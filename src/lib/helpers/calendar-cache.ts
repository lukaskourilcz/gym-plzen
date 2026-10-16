import type { CalendarView } from "@/lib/config/booking-calendar";
export const CALENDAR_CACHE_TTL = 15_000;
const keyFor = (month: string, date: string | null) => `${month}/${date ?? ""}`;
/** In-memory, public data only. An invalidation also discards in-flight responses. */
export class CalendarAvailabilityCache {
  private values = new Map<string, { value: CalendarView; at: number }>();
  private pending = new Map<string, Promise<CalendarView>>();
  private generation = 0;
  peek(month: string, date: string | null, now = Date.now()) {
    const row = this.values.get(keyFor(month, date));
    return row && now - row.at < CALENDAR_CACHE_TTL ? row.value : null;
  }
  seed(value: CalendarView, now = Date.now()) {
    if (value.source !== "live") return;
    const key = keyFor(value.monthKey, value.selectedDateKey);
    this.values.delete(key);
    this.values.set(key, { value, at: now });
    if (this.values.size > 12)
      this.values.delete(this.values.keys().next().value!);
  }
  invalidate() {
    this.generation++;
    this.values.clear();
    this.pending.clear();
  }
  async load(
    month: string,
    date: string | null,
    fetcher: () => Promise<CalendarView>,
  ): Promise<CalendarView> {
    const cached = this.peek(month, date);
    if (cached) return cached;
    const key = keyFor(month, date),
      existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const request = fetcher()
      .then((value) => {
        if (generation !== this.generation)
          throw new Error("availability_invalidated");
        this.seed(value);
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request;
  }
}
