import {
  getTableColumns,
  and,
  count,
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
import { allowedValue, type AdminFilters } from "@/lib/helpers/admin-list";
import { pageLimit, pageOffset } from "@/lib/helpers/pagination";
import { emailRetentionCutoff } from "@/lib/helpers/email-retention";
import {
  adminOrder,
  adminTotalCount,
  adminDateFilter,
  adminOverlapFilter,
  adminTextSearch,
} from "./admin-list-query";
import { toMember } from "./members";

/** Bounded database readers for pages that authorize with requireAdmin first. */
export async function reservationPage(page: number, filters: AdminFilters) {
  const status = allowedValue(filters.status, reservationStatus.enumValues);
  const rows = await db
    .select({ row: reservation, totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: reservation.startsAt,
          name: sql`coalesce(${reservation.contactName},${profiles.fullName})`,
          email: sql`coalesce(${reservation.contactEmail},${profiles.email})`,
          price: reservation.priceCents,
          status: reservation.status,
          created: reservation.createdAt,
        },
        reservation.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((r) => ({ ...r.row, totalCount: r.totalCount }));
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
      totalCount: adminTotalCount,
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: accessCode.createdAt,
          name: sql`coalesce(${reservation.contactName},${profiles.fullName})`,
          email: sql`coalesce(${reservation.contactEmail},${profiles.email})`,
          start: accessCode.validFrom,
          end: accessCode.validUntil,
          status: state,
        },
        accessCode.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
}

export async function memberPage(page: number, filters: AdminFilters) {
  const role = allowedValue(filters.role, ["admin", "member"] as const);
  const rows = await db
    .select({ ...getTableColumns(profiles), totalCount: adminTotalCount })
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
        filters.whatsapp === "enabled"
          ? eq(profiles.notifyByWhatsapp, true)
          : filters.whatsapp === "disabled"
            ? eq(profiles.notifyByWhatsapp, false)
            : undefined,
      ),
    )
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: profiles.createdAt,
          name: profiles.fullName,
          email: profiles.email,
          phone: profiles.phone,
          role: profiles.role,
        },
        profiles.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((row) => ({ ...toMember(row), totalCount: row.totalCount }));
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
      totalCount: adminTotalCount,
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: emailArchive.sentAt,
          name: emailCustomerName,
          email: emailArchive.recipient,
        },
        emailArchive.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
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
      totalCount: adminTotalCount,
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: sql`coalesce(${messageDelivery.sentAt},${messageDelivery.createdAt})`,
          name: sql`coalesce(${reservation.contactName},${profiles.fullName})`,
          email: messageDelivery.recipient,
        },
        messageDelivery.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((r) => ({
    ...r.message,
    totalCount: r.totalCount,
    customerName: r.customerName,
  }));
}

export async function activityPage(
  page: number,
  filters: AdminFilters,
  memberId?: string,
) {
  const rows = await db
    .select({ row: activityLog, totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: activityLog.occurredAt,
          name: activityLog.actorLabel,
          action: activityLog.action,
        },
        activityLog.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((r) => ({ ...r.row, totalCount: r.totalCount }));
}

export function memberMessagePage(
  userId: string,
  page: number,
  filters: AdminFilters,
) {
  return db
    .select({
      totalCount: adminTotalCount,
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: sql`coalesce(${messageDelivery.sentAt},${messageDelivery.createdAt})`,
          email: messageDelivery.recipient,
        },
        messageDelivery.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
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
    .select({ row: entryLog, totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: entryLog.occurredAt,
          name: entryLog.nukiName,
          action: entryLog.action,
          trigger: entryLog.trigger,
        },
        entryLog.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
  return rows.map((r) => ({ ...r.row, totalCount: r.totalCount }));
}

export function alertPage(page: number, filters: AdminFilters) {
  const severity = allowedValue(filters.severity, alertseverity.enumValues);
  return db
    .select({ ...getTableColumns(systemAlert), totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: systemAlert.createdAt,
          name: systemAlert.title,
          severity: systemAlert.severity,
          resolved: systemAlert.resolvedAt,
        },
        systemAlert.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
}

export function invoicePage(page: number, filters: AdminFilters) {
  return db
    .select({ ...getTableColumns(invoice), totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: invoice.issuedAt,
          name: invoice.customerName,
          email: invoice.customerEmail,
          number: invoice.number,
          price: invoice.totalCents,
          sent: invoice.sentAt,
        },
        invoice.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
}

export async function newsletterPage(page: number, filters: AdminFilters) {
  const status = allowedValue(
    filters.status,
    newsletterSubscriptionStatus.enumValues,
  );
  const name = sql`(select p.full_name from public.profiles p where lower(p.email)=lower(${newsletterSubscriber.email}) order by p.created_at desc,p.id desc limit 1)`;
  const [rows, totals] = await Promise.all([
    db
      .select({
        ...getTableColumns(newsletterSubscriber),
        totalCount: adminTotalCount,
      })
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
        ...adminOrder(
          filters,
          {
            date: newsletterSubscriber.createdAt,
            email: newsletterSubscriber.email,
            status: newsletterSubscriber.status,
            source: newsletterSubscriber.source,
          },
          newsletterSubscriber.id,
        ),
      )
      .limit(pageLimit(filters.pageSize))
      .offset(pageOffset(page, filters.pageSize)),
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
    .select({ ...getTableColumns(blockedSlot), totalCount: adminTotalCount })
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
    .orderBy(
      ...adminOrder(
        filters,
        {
          date: blockedSlot.startsAt,
          end: blockedSlot.endsAt,
          reason: blockedSlot.reason,
          name: blockedSlot.note,
        },
        blockedSlot.id,
      ),
    )
    .limit(pageLimit(filters.pageSize))
    .offset(pageOffset(page, filters.pageSize));
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
      .select({
        totalCount: adminTotalCount,
        voucher,
        redeemedCount: redeemed,
        reservedCount: reserved,
      })
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
      .orderBy(
        ...adminOrder(
          filters,
          {
            date: voucher.createdAt,
            name: voucher.code,
            start: voucher.validFrom,
            end: voucher.validUntil,
            usage: redeemed,
            status: state,
          },
          voucher.id,
        ),
      )
      .limit(pageLimit(filters.pageSize))
      .offset(pageOffset(page, filters.pageSize)),
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
      totalCount: r.totalCount,
      redeemedCount: r.redeemedCount,
      reservedCount: r.reservedCount,
    })),
    totals: totals[0]!,
  };
}
