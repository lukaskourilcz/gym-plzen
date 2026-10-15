import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { allowedValue, type AdminFilters } from "@/lib/helpers/admin-list";
import { pageLimit, pageOffset } from "@/lib/helpers/pagination";
import {
  adminDateFilter,
  adminOrder,
  adminTextSearch,
  adminTotalCount,
} from "./admin-list-query";
import { toMember } from "./members";

/**
 * Guest contacts already persist on reservations. A read-only directory groups
 * them by normalized email; it never creates Auth identities, links ownership,
 * rewrites reservations, or copies a guest's input into an account profile.
 */
export async function memberDirectoryPage(page: number, filters: AdminFilters) {
  const directory = sql`(
    select p.id, coalesce(nullif(p.full_name,''),p.email,'Člen') as name,
      p.email,p.phone,p.role,p.created_at,p.notify_by_whatsapp as whatsapp,
      'registered'::text as registration
    from public.profiles p
    union all
    select (array_agg(r.id order by r.created_at,r.id))[1] as id,
      coalesce((array_agg(nullif(btrim(r.contact_name),'') order by r.created_at desc,r.id desc)
        filter (where nullif(btrim(r.contact_name),'') is not null))[1], min(btrim(r.contact_email))) as name,
      lower(btrim(r.contact_email)) as email,
      (array_agg(nullif(btrim(r.contact_phone),'') order by r.created_at desc,r.id desc)
        filter (where nullif(btrim(r.contact_phone),'') is not null))[1] as phone,
      'guest'::text as role,min(r.created_at) as created_at,false as whatsapp,
      'guest'::text as registration
    from public.reservation r
    where r.user_id is null and nullif(btrim(r.contact_email),'') is not null
      and not exists (select 1 from public.profiles p where lower(btrim(p.email))=lower(btrim(r.contact_email)))
    group by lower(btrim(r.contact_email))
  ) directory`;
  const columns = {
    date: sql`directory.created_at`,
    name: sql`directory.name`,
    email: sql`directory.email`,
    phone: sql`directory.phone`,
    role: sql`directory.role`,
  };
  const role = allowedValue(filters.role, ["admin", "member"] as const);
  const registration = allowedValue(filters.registration, [
    "registered",
    "guest",
  ] as const);
  const rows = await db
    .select({
      id: sql<string>`directory.id`,
      name: sql<string>`directory.name`,
      email: sql<string>`directory.email`,
      phone: sql<string | null>`directory.phone`,
      role: sql<string>`directory.role`,
      createdAt: sql<Date>`directory.created_at`.mapWith(profiles.createdAt),
      registration: sql<"registered" | "guest">`directory.registration`,
      profile: profiles,
      totalCount: adminTotalCount,
    })
    .from(directory)
    .leftJoin(
      profiles,
      and(
        eq(profiles.id, sql`directory.id`),
        sql`directory.registration='registered'`,
      ),
    )
    .where(
      and(
        adminTextSearch(filters.q, columns.name, columns.email, columns.phone),
        adminDateFilter(columns.date, filters),
        role ? sql`directory.role=${role}` : undefined,
        registration ? sql`directory.registration=${registration}` : undefined,
        filters.whatsapp === "enabled"
          ? sql`directory.whatsapp=true`
          : filters.whatsapp === "disabled"
            ? sql`directory.whatsapp=false`
            : undefined,
      ),
    )
    .orderBy(...adminOrder(filters, columns, sql`directory.id`))
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((row) => ({
    ...(row.profile
      ? toMember(row.profile)
      : {
          user: {
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            createdAt: row.createdAt,
          },
          profile: null,
        }),
    registration: row.registration,
    contactPhone: row.phone,
    totalCount: row.totalCount,
  }));
}
