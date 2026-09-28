import { MAX_SLOTS_PER_ORDER } from "@/lib/config/orders";

/**
 * The slots a visitor has picked, carried in the URL as repeated `start`
 * parameters (`?start=…&start=…`), so the selection survives a reload, a
 * shared link and moving between days and months. Pure helpers, used by the
 * calendar, the details step and their links alike.
 */

/** Valid, unique, chronologically sorted instants, at most one order's worth. */
export function parseSelectedStarts(
  value: string | readonly string[] | undefined | null,
): Date[] {
  const raw = value === undefined || value === null ? [] : [value].flat();
  const unique = new Map<number, Date>();
  for (const item of raw) {
    const at = new Date(item);
    if (!Number.isNaN(at.getTime())) unique.set(at.getTime(), at);
  }
  return [...unique.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, MAX_SLOTS_PER_ORDER);
}

/** `start=…&start=…` appended to existing parameters, in start order. */
export function withSelectedStarts(
  params: URLSearchParams,
  starts: readonly (Date | string)[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("start");
  const sorted = [...starts]
    .map((at) => (typeof at === "string" ? at : at.toISOString()))
    .sort();
  for (const start of sorted) next.append("start", start);
  return next;
}

/** The details step for a selection. */
export function detailsHref(starts: readonly (Date | string)[]): string {
  return `/rezervace/udaje?${withSelectedStarts(new URLSearchParams(), starts).toString()}`;
}

/**
 * Which positions of a chronologically sorted selection a member gets free:
 * the `entriesUntilFree`-th slot and every `cadence`-th after it. Mirrors the
 * order's own allocation, for a live total before the details step.
 */
export function rewardPositions(
  count: number,
  entriesUntilFree: number,
  cadence: number,
): boolean[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    return (
      position >= entriesUntilFree &&
      (position - entriesUntilFree) % cadence === 0
    );
  });
}
