/**
 * Reading a list one page at a time.
 *
 * A page is one-based and bounded: a hand-written `?page=` must not turn into
 * an enormous offset. Whether a next page exists is answered by reading one
 * row beyond the page size (`hasNextPage`), so no page pays for a count query
 * over a table that only grows.
 */

const MAX_PAGE = 10_000;

/** The page number from a query parameter; anything unusable is page one. */
export function pageFromParam(value: string | string[] | undefined): number {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Math.min(MAX_PAGE, Math.max(1, Number(value)))
    : 1;
}

/** How many rows to read for one page: the page plus the row that proves a next one. */
export function pageLimit(pageSize: number): number {
  return pageSize + 1;
}

/** The offset of a one-based page. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Split an over-read page into the rows to render and whether another follows. */
export function splitPage<T>(
  rows: T[],
  pageSize: number,
): { rows: T[]; hasNext: boolean } {
  return { rows: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}
