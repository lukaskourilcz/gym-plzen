import { addDaysToDateKey, isDateKey, localDateTimeToDate } from "./datetime";
import { pageFromParam, pageOffset, splitPage } from "./pagination";

export type AdminSearchParams = Record<string, string | string[] | undefined>;
export const ADMIN_PAGE_SIZE = 20;
const FILTER_KEYS = [
  "q",
  "from",
  "to",
  "status",
  "channel",
  "kind",
  "role",
  "severity",
  "state",
  "reason",
  "delivery",
  "action",
  "trigger",
  "whatsapp",
] as const;
export type AdminFilterKey = (typeof FILTER_KEYS)[number];
export type AdminFilters = Record<AdminFilterKey, string> & {
  invalidDates: boolean;
  pageSize: number;
  sort: string;
  direction: "asc" | "desc";
};

export function stringParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export function readAdminFilters(params: AdminSearchParams): AdminFilters {
  const fields = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, stringParam(params[key])]),
  ) as Record<AdminFilterKey, string>;
  const invalidDates = Boolean(
    (fields.from && !isDateKey(fields.from)) ||
    (fields.to && (!isDateKey(fields.to) || fields.to === "9999-12-31")) ||
    (fields.from && fields.to && fields.from > fields.to),
  );
  return {
    ...fields,
    invalidDates,
    pageSize: ["20", "50", "100"].includes(stringParam(params.pageSize))
      ? Number(params.pageSize)
      : ADMIN_PAGE_SIZE,
    sort: stringParam(params.sort) || "date",
    direction: params.direction === "asc" ? "asc" : "desc",
  };
}

/** Inclusive Czech calendar days, including the 23/25-hour DST days. */
export function adminDateBounds(filters: AdminFilters) {
  if (filters.invalidDates) return { invalid: true } as const;
  return {
    invalid: false,
    start: filters.from ? localDateTimeToDate(filters.from, 0) : undefined,
    end: filters.to
      ? localDateTimeToDate(addDaysToDateKey(filters.to, 1), 0)
      : undefined,
  } as const;
}

export function normalizedSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("cs-CZ");
}

/** Literal substring: user-entered %/_ must not become SQL wildcards. */
export function searchPattern(value: string): string {
  return `%${normalizedSearch(value).replace(/[\\%_]/g, "\\$&")}%`;
}

export function allowedValue<T extends string>(
  value: string,
  values: readonly T[],
): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}

/** Only list state survives pagination; successful-action flash messages do not. */
export function adminPageHref(
  path: string,
  params: AdminSearchParams,
  page: number,
  pageKey = "page",
): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = stringParam(params[key]);
    if (value) query.set(key, value);
  }
  for (const key of ["pageSize", "sort", "direction"]) {
    const value = stringParam(params[key]);
    if (value) query.set(key, value);
  }
  for (const key of [
    "emailPage",
    "messagePage",
    "reservationPage",
    "activityPage",
  ]) {
    if (key !== pageKey && params[key])
      query.set(key, String(pageFromParam(params[key])));
  }
  query.set(pageKey, String(page));
  return `${path}?${query}`;
}

/** Same filtering for the small, explicitly authenticated local demo fixtures. */
export function demoAdminPage<T>(
  rows: T[],
  page: number,
  filters: AdminFilters,
  fields: (row: T) => {
    text: string;
    date: Date;
    status?: string;
    channel?: string;
    kind?: string;
    role?: string;
    action?: string;
    trigger?: string;
    whatsapp?: string;
    name?: string;
    email?: string;
    sortValues?: Record<string, string | number | Date | null>;
  },
) {
  const bounds = adminDateBounds(filters);
  const filtered = bounds.invalid
    ? []
    : rows.filter((row) => {
        const value = fields(row);
        return (
          (!filters.q ||
            normalizedSearch(value.text).includes(
              normalizedSearch(filters.q),
            )) &&
          (!bounds.start || value.date >= bounds.start) &&
          (!bounds.end || value.date < bounds.end) &&
          (
            [
              "status",
              "channel",
              "kind",
              "role",
              "action",
              "trigger",
              "whatsapp",
            ] as const
          ).every(
            (key) =>
              !filters[key] ||
              value[key] === undefined ||
              value[key] === filters[key],
          )
        );
      });
  const value = (row: T) => {
    const f = fields(row);
    if (f.sortValues && Object.hasOwn(f.sortValues, filters.sort))
      return f.sortValues[filters.sort];
    return filters.sort === "name"
      ? (f.name ?? f.text)
      : filters.sort === "email"
        ? (f.email ?? f.text)
        : f.date;
  };
  filtered.sort((a, b) => {
    const x = value(a),
      y = value(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    const compared =
      x instanceof Date && y instanceof Date
        ? x.getTime() - y.getTime()
        : typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x ?? "").localeCompare(String(y ?? ""), "cs");
    return filters.direction === "asc" ? compared : -compared;
  });
  return {
    totalCount: filtered.length,
    ...splitPage(
      filtered.slice(
        pageOffset(page, filters.pageSize),
        pageOffset(page, filters.pageSize) + filters.pageSize + 1,
      ),
      filters.pageSize,
    ),
  };
}

/** Window counts describe the complete filtered list, even on an empty later page. */
export async function splitAdminPage<T>(
  rows: T[],
  page: number,
  filters: AdminFilters,
  readFirst: () => Promise<readonly unknown[]>,
) {
  const totalFrom = (items: readonly unknown[]) => {
    const first = items[0];
    return first && typeof first === "object" && "totalCount" in first
      ? Number(first.totalCount)
      : 0;
  };
  const totalCount =
    rows.length || page === 1 ? totalFrom(rows) : totalFrom(await readFirst());
  return { ...splitPage(rows, filters.pageSize), totalCount };
}
