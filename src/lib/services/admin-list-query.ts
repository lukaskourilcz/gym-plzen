import { and, or, sql, type SQLWrapper } from "drizzle-orm";
import {
  adminDateBounds,
  searchPattern,
  type AdminFilters,
} from "@/lib/helpers/admin-list";

export function adminTextSearch(query: string, ...fields: SQLWrapper[]) {
  if (!query) return undefined;
  const pattern = searchPattern(query);
  return or(
    ...fields.map(
      (field) =>
        sql`translate(lower(coalesce(${field}, '')), 'áčďéěíňóřšťúůýž', 'acdeeinorstuuyz') like ${pattern}`,
    ),
  );
}

export function adminDateFilter(field: SQLWrapper, filters: AdminFilters) {
  const bounds = adminDateBounds(filters);
  if (bounds.invalid) return sql`false`;
  return and(
    bounds.start
      ? sql`${field} >= ${bounds.start.toISOString()}::timestamptz`
      : undefined,
    bounds.end
      ? sql`${field} < ${bounds.end.toISOString()}::timestamptz`
      : undefined,
  );
}

/** Include a block already in progress on the first selected day. */
export function adminOverlapFilter(
  start: SQLWrapper,
  end: SQLWrapper,
  filters: AdminFilters,
) {
  const bounds = adminDateBounds(filters);
  if (bounds.invalid) return sql`false`;
  return and(
    bounds.start
      ? sql`${end} > ${bounds.start.toISOString()}::timestamptz`
      : undefined,
    bounds.end
      ? sql`${start} < ${bounds.end.toISOString()}::timestamptz`
      : undefined,
  );
}

/** SQL expressions come only from the caller's allowlist; URL input is never SQL. */
export function adminOrder(
  filters: AdminFilters,
  columns: Record<string, SQLWrapper>,
  id: SQLWrapper,
) {
  const field = Object.hasOwn(columns, filters.sort)
    ? columns[filters.sort]!
    : columns.date!;
  const direction = filters.direction === "asc" ? sql`asc` : sql`desc`;
  return [sql`${field} ${direction} nulls last`, sql`${id} ${direction}`];
}
export const adminTotalCount = sql<number>`count(*) over ()`.mapWith(Number);
