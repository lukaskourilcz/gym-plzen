import {
  and,
  count,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  notExists,
  or,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessCode,
  activityLog,
  blockedSlot,
  emailArchive,
  entryLog,
  invoice,
  messageDelivery,
  newsletterSubscriber,
  profiles,
  reservation,
  systemAlert,
  voucher,
  voucherRedemption,
} from "@/lib/db/schema";
import {
  alertseverity,
  blockReason,
  messageChannel,
  messageKind,
  messageStatus,
  newsletterSubscriptionStatus,
  reservationStatus,
  voucherKind,
} from "@/lib/db/schema/enums";
import {
  ADMIN_PAGE_SIZE,
  allowedValue,
  type AdminFilters,
} from "@/lib/helpers/admin-list";
import { pageLimit, pageOffset } from "@/lib/helpers/pagination";
import { emailRetentionCutoff } from "@/lib/helpers/email-retention";
import {
  adminDateFilter,
  adminOverlapFilter,
  adminTextSearch,
} from "./admin-list-query";
import { toMember } from "./members";

/** Bounded database readers for pages that authorize with requireAdmin first. */
export async function reservationPage(page: number, filters: AdminFilters) {
  const status = allowedValue(filters.status, reservationStatus.enumValues);
  const rows = await db
    .select({ row: reservation })
    .from(reservation)
    .leftJoin(profiles, eq(profiles.id, reservation.userId))
    .where(
      and(
        adminTextSearch(
          filters.q,
          reservation.contactName,
          reservation.contactEmail,
          profiles.fullName,
          profiles.email,
        ),
        adminDateFilter(reservation.startsAt, filters),
        status ? eq(reservation.status, status) : undefined,
      ),
    )
    .orderBy(desc(reservation.startsAt), desc(reservation.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
  return rows.map((r) => r.row);
}

/** SQL uses the same time-based precedence as accessCodeStatusLabel. */
export function accessCodePage(
  page: number,
  filters: AdminFilters,
  now = new Date(),
) {
  const state = sql`case when ${accessCode.status}='revoked' then 'revoked'
    when ${accessCode.status}='expired' or ${accessCode.validUntil}<=${now.toISOString()}::timestamptz then 'expired'
    when ${accessCode.status}='failed' then 'failed'
    when ${accessCode.validFrom}>${now.toISOString()}::timestamptz then 'scheduled'
    else 'active' end`;
  const wanted = allowedValue(filters.state, [
    "revoked",
    "expired",
    "failed",
    "scheduled",
    "active",
  ]);
  return db
    .select({
      code: accessCode,
      reservationId: reservation.id,
      reservationStart: reservation.startsAt,
      reservationEnd: reservation.endsAt,
      reservationStatus: reservation.status,
      userId: reservation.userId,
      name: reservation.contactName,
      email: reservation.contactEmail,
      memberName: profiles.fullName,
      memberEmail: profiles.email,
    })
    .from(accessCode)
    .innerJoin(reservation, eq(reservation.id, accessCode.reservationId))
    .leftJoin(profiles, eq(profiles.id, reservation.userId))
    .where(
      and(
        adminTextSearch(
          filters.q,
          reservation.contactName,
          reservation.contactEmail,
          profiles.fullName,
          profiles.email,
        ),
        adminOverlapFilter(
          accessCode.validFrom,
          accessCode.validUntil,
          filters,
        ),
        wanted ? sql`${state}=${wanted}` : undefined,
      ),
    )
    .orderBy(desc(accessCode.createdAt), desc(accessCode.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

export async function memberPage(page: number, filters: AdminFilters) {
  const role = allowedValue(filters.role, ["admin", "member"] as const);
  const rows = await db
    .select()
    .from(profiles)
    .where(
      and(
        adminTextSearch(
          filters.q,
          profiles.fullName,
          profiles.email,
          profiles.phone,
        ),
        adminDateFilter(profiles.createdAt, filters),
        role ? eq(profiles.role, role) : undefined,
      ),
    )
    .orderBy(desc(profiles.createdAt), desc(profiles.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
  return rows.map(toMember);
}

/** Scalar lookup avoids duplicating rows when a provider has several attempts. */
const emailCustomerName = sql<string | null>`coalesce(
  (select coalesce(r.contact_name, p.full_name) from public.message_delivery m
   left join public.reservation r on r.id=m.reservation_id
   left join public.profiles p on p.id=coalesce(m.user_id,r.user_id)
   where m.provider_message_id=email_archive.provider_message_id and m.channel='email'
   order by m.created_at desc,m.id desc limit 1),
  (select p.full_name from public.profiles p where lower(p.email)=lower(email_archive.recipient)
   order by p.created_at desc,p.id desc limit 1))`;

/** Retained archive metadata only; never read HTML/PIN bodies for a table. */
export async function emailPage(
  page: number,
  filters: AdminFilters,
  now = new Date(),
) {
  const status = allowedValue(filters.status, messageStatus.enumValues);
  const kind = allowedValue(filters.kind, messageKind.enumValues);
  const channel = allowedValue(filters.channel, messageChannel.enumValues);
  const matchingDelivery =
    status || kind
      ? sql`exists (
    select 1 from public.message_delivery m
    where m.provider_message_id=${emailArchive.providerMessageId} and m.channel='email'
    ${status ? sql`and m.status=${status}` : sql``}
    ${kind ? sql`and m.kind=${kind}` : sql``}
  )`
      : undefined;
  return db
    .select({
      id: emailArchive.id,
      subject: emailArchive.subject,
      recipient: emailArchive.recipient,
      sentAt: emailArchive.sentAt,
      customerName: emailCustomerName,
    })
    .from(emailArchive)
    .where(
      and(
        gt(emailArchive.sentAt, emailRetentionCutoff(now)),
        adminDateFilter(emailArchive.sentAt, filters),
        adminTextSearch(
          filters.q,
          emailArchive.recipient,
          emailArchive.subject,
          emailCustomerName,
        ),
        channel && channel !== "email" ? sql`false` : undefined,
        matchingDelivery,
      ),
    )
    .orderBy(desc(emailArchive.sentAt), desc(emailArchive.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

/** Delivery attempts without a retained preview, including failures/WhatsApp/SMS. */
export async function messagePage(
  page: number,
  filters: AdminFilters,
  now = new Date(),
) {
  const status = allowedValue(filters.status, messageStatus.enumValues);
  const kind = allowedValue(filters.kind, messageKind.enumValues);
  const channel = allowedValue(filters.channel, messageChannel.enumValues);
  const sentAt = sql`coalesce(${messageDelivery.sentAt},${messageDelivery.createdAt})`;
  const retainedPreview = db
    .select({ id: emailArchive.id })
    .from(emailArchive)
    .where(
      and(
        eq(emailArchive.providerMessageId, messageDelivery.providerMessageId),
        gt(emailArchive.sentAt, emailRetentionCutoff(now)),
      ),
    );
  const rows = await db
    .select({
      message: messageDelivery,
      customerName: sql<
        string | null
      >`coalesce(${reservation.contactName},${profiles.fullName})`,
    })
    .from(messageDelivery)
    .leftJoin(reservation, eq(reservation.id, messageDelivery.reservationId))
    .leftJoin(
      profiles,
      sql`${profiles.id}=coalesce(${messageDelivery.userId},${reservation.userId})`,
    )
    .where(
      and(
        or(ne(messageDelivery.channel, "email"), notExists(retainedPreview)),
        gt(messageDelivery.createdAt, emailRetentionCutoff(now)),
        adminDateFilter(sentAt, filters),
        adminTextSearch(
          filters.q,
          messageDelivery.recipient,
          reservation.contactName,
          reservation.contactEmail,
          profiles.fullName,
          profiles.email,
        ),
        status ? eq(messageDelivery.status, status) : undefined,
        kind ? eq(messageDelivery.kind, kind) : undefined,
        channel ? eq(messageDelivery.channel, channel) : undefined,
      ),
    )
    .orderBy(desc(messageDelivery.createdAt), desc(messageDelivery.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
  return rows.map((r) => ({ ...r.message, customerName: r.customerName }));
}

export async function activityPage(
  page: number,
  filters: AdminFilters,
  memberId?: string,
) {
  const rows = await db
    .select({ row: activityLog })
    .from(activityLog)
    .leftJoin(profiles, eq(profiles.id, activityLog.memberId))
    .where(
      and(
        memberId ? eq(activityLog.memberId, memberId) : undefined,
        adminTextSearch(
          filters.q,
          activityLog.actorLabel,
          activityLog.summary,
          profiles.fullName,
          profiles.email,
        ),
        adminDateFilter(activityLog.occurredAt, filters),
        filters.action ? eq(activityLog.action, filters.action) : undefined,
      ),
    )
    .orderBy(desc(activityLog.occurredAt), desc(activityLog.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
  return rows.map((r) => r.row);
}

export function memberMessagePage(
  userId: string,
  page: number,
  filters: AdminFilters,
) {
  return db
    .select({
      id: messageDelivery.id,
      createdAt: messageDelivery.createdAt,
      sentAt: messageDelivery.sentAt,
      channel: messageDelivery.channel,
      kind: messageDelivery.kind,
      recipient: messageDelivery.recipient,
      status: messageDelivery.status,
    })
    .from(messageDelivery)
    .where(
      and(
        eq(messageDelivery.userId, userId),
        adminTextSearch(filters.q, messageDelivery.recipient),
        adminDateFilter(
          sql`coalesce(${messageDelivery.sentAt},${messageDelivery.createdAt})`,
          filters,
        ),
      ),
    )
    .orderBy(desc(messageDelivery.createdAt), desc(messageDelivery.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

export async function entryPage(page: number, filters: AdminFilters) {
  const action = allowedValue(filters.action, [
    "unlock",
    "lock",
    "unlatch",
    "lock_n_go",
    "keypad_open",
    "keypad_failure",
  ]);
  const trigger = allowedValue(filters.trigger, [
    "system",
    "manual",
    "button",
    "automatic",
    "web",
    "app",
    "auto_lock",
    "accessory",
    "keypad",
  ]);
  const rows = await db
    .select({ row: entryLog })
    .from(entryLog)
    .leftJoin(reservation, eq(reservation.id, entryLog.reservationId))
    .leftJoin(profiles, eq(profiles.id, entryLog.userId))
    .where(
      and(
        adminTextSearch(
          filters.q,
          entryLog.nukiName,
          reservation.contactName,
          reservation.contactEmail,
          profiles.fullName,
          profiles.email,
        ),
        adminDateFilter(entryLog.occurredAt, filters),
        action === "keypad_failure"
          ? sql`${entryLog.action} like 'keypad_failure_%'`
          : action
            ? eq(entryLog.action, action)
            : undefined,
        trigger ? eq(entryLog.trigger, trigger) : undefined,
      ),
    )
    .orderBy(desc(entryLog.occurredAt), desc(entryLog.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
  return rows.map((r) => r.row);
}

export function alertPage(page: number, filters: AdminFilters) {
  const severity = allowedValue(filters.severity, alertseverity.enumValues);
  return db
    .select()
    .from(systemAlert)
    .where(
      and(
        adminTextSearch(filters.q, systemAlert.title, systemAlert.body),
        adminDateFilter(systemAlert.createdAt, filters),
        severity ? eq(systemAlert.severity, severity) : undefined,
        filters.state === "open"
          ? isNull(systemAlert.resolvedAt)
          : filters.state === "resolved"
            ? isNotNull(systemAlert.resolvedAt)
            : undefined,
      ),
    )
    .orderBy(desc(systemAlert.createdAt), desc(systemAlert.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

export function invoicePage(page: number, filters: AdminFilters) {
  return db
    .select()
    .from(invoice)
    .where(
      and(
        adminTextSearch(
          filters.q,
          invoice.customerName,
          invoice.customerEmail,
          invoice.number,
        ),
        adminDateFilter(invoice.issuedAt, filters),
        filters.delivery === "sent"
          ? isNotNull(invoice.sentAt)
          : filters.delivery === "unsent"
            ? isNull(invoice.sentAt)
            : undefined,
      ),
    )
    .orderBy(desc(invoice.issuedAt), desc(invoice.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

export async function newsletterPage(page: number, filters: AdminFilters) {
  const status = allowedValue(
    filters.status,
    newsletterSubscriptionStatus.enumValues,
  );
  const name = sql`(select p.full_name from public.profiles p where lower(p.email)=lower(${newsletterSubscriber.email}) order by p.created_at desc,p.id desc limit 1)`;
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(newsletterSubscriber)
      .where(
        and(
          adminTextSearch(
            filters.q,
            newsletterSubscriber.email,
            newsletterSubscriber.source,
            name,
          ),
          adminDateFilter(newsletterSubscriber.consentedAt, filters),
          status ? eq(newsletterSubscriber.status, status) : undefined,
        ),
      )
      .orderBy(
        desc(newsletterSubscriber.createdAt),
        desc(newsletterSubscriber.id),
      )
      .limit(pageLimit(ADMIN_PAGE_SIZE))
      .offset(pageOffset(page, ADMIN_PAGE_SIZE)),
    db
      .select({
        total: count(),
        active:
          sql<number>`count(*) filter (where ${newsletterSubscriber.status}='subscribed')`.mapWith(
            Number,
          ),
      })
      .from(newsletterSubscriber),
  ]);
  return { rows, totals: totals[0]! };
}

export function blockPage(
  page: number,
  filters: AdminFilters,
  now = new Date(),
) {
  const reason = allowedValue(filters.reason, blockReason.enumValues);
  return db
    .select()
    .from(blockedSlot)
    .where(
      and(
        adminTextSearch(filters.q, blockedSlot.note, blockedSlot.reason),
        adminOverlapFilter(blockedSlot.startsAt, blockedSlot.endsAt, filters),
        !filters.from && !filters.to && !filters.q && !reason
          ? gt(blockedSlot.endsAt, now)
          : undefined,
        reason ? eq(blockedSlot.reason, reason) : undefined,
      ),
    )
    .orderBy(asc(blockedSlot.startsAt), asc(blockedSlot.id))
    .limit(pageLimit(ADMIN_PAGE_SIZE))
    .offset(pageOffset(page, ADMIN_PAGE_SIZE));
}

export async function voucherPage(
  page: number,
  filters: AdminFilters,
  now = new Date(),
) {
  const usage = db
    .select({
      voucherId: voucherRedemption.voucherId,
      redeemed:
        sql<number>`count(*) filter (where ${voucherRedemption.status}='redeemed')`.as(
          "redeemed_count",
        ),
      reserved:
        sql<number>`count(*) filter (where ${voucherRedemption.status}='reserved' and ${voucherRedemption.reservedUntil}>${now.toISOString()}::timestamptz)`.as(
          "reserved_count",
        ),
    })
    .from(voucherRedemption)
    .groupBy(voucherRedemption.voucherId)
    .as("voucher_usage");
  const redeemed = sql<number>`coalesce(${usage.redeemed},0)`.mapWith(Number);
  const reserved = sql<number>`coalesce(${usage.reserved},0)`.mapWith(Number);
  const state = sql<string>`case when not ${voucher.isActive} then 'inactive'
    when ${voucher.validFrom}>${now.toISOString()}::timestamptz then 'scheduled'
    when ${voucher.validUntil}<=${now.toISOString()}::timestamptz then 'expired'
    when ${voucher.maxRedemptions} is not null and ${redeemed}>=${voucher.maxRedemptions} then 'exhausted'
    else 'active' end`;
  const wantedState = allowedValue(filters.state, [
    "active",
    "inactive",
    "scheduled",
    "expired",
    "exhausted",
  ]);
  const kind = allowedValue(filters.kind, voucherKind.enumValues);
  const [rows, totals] = await Promise.all([
    db
      .select({ voucher, redeemedCount: redeemed, reservedCount: reserved })
      .from(voucher)
      .leftJoin(usage, eq(usage.voucherId, voucher.id))
      .where(
        and(
          adminTextSearch(filters.q, voucher.code),
          adminDateFilter(voucher.createdAt, filters),
          wantedState ? sql`${state}=${wantedState}` : undefined,
          kind ? eq(voucher.kind, kind) : undefined,
        ),
      )
      .orderBy(desc(voucher.createdAt), desc(voucher.id))
      .limit(pageLimit(ADMIN_PAGE_SIZE))
      .offset(pageOffset(page, ADMIN_PAGE_SIZE)),
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${state}='active')`.mapWith(
          Number,
        ),
        redeemed: sql<number>`coalesce(sum(${redeemed}),0)`.mapWith(Number),
      })
      .from(voucher)
      .leftJoin(usage, eq(usage.voucherId, voucher.id)),
  ]);
  return {
    rows: rows.map((r) => ({
      ...r.voucher,
      redeemedCount: r.redeemedCount,
      reservedCount: r.reservedCount,
    })),
    totals: totals[0]!,
  };
}
