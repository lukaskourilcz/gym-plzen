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
