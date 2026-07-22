import { httpRequest } from "@/lib/helpers/http";
import { addMinutes } from "@/lib/helpers/datetime";
import { aggregateStats, type Stats } from "@/lib/services/stats";
import type { EntryLog, MessageDelivery, Reservation } from "@/lib/db/types";
import type { MemberWithProfile } from "@/lib/services/members";

/**
 * Demo data layer backed by DummyJSON (https://dummyjson.com). Used to populate
 * admin lists with realistic fake members/bookings BEFORE the real database is
 * connected, so we can review every screen and spot what to improve. Every
 * consuming page shows a "ukázková data" banner when this is active.
 *
 * Fetches real fake users from DummyJSON; if the network is unavailable it
 * falls back to a small built-in list so the UI always has something to show.
 */

interface DummyUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  image?: string;
}

const FALLBACK_USERS: DummyUser[] = [
  {
    id: 1,
    firstName: "Jan",
    lastName: "Novák",
    email: "jan.novak@example.com",
    phone: "+420777111222",
  },
  {
    id: 2,
    firstName: "Petra",
    lastName: "Svobodová",
    email: "petra.s@example.com",
    phone: "+420777333444",
  },
  {
    id: 3,
    firstName: "Tomáš",
    lastName: "Dvořák",
    email: "tomas.d@example.com",
    phone: "+420777555666",
  },
  {
    id: 4,
    firstName: "Lucie",
    lastName: "Černá",
    email: "lucie.c@example.com",
    phone: "+420777777888",
  },
  {
    id: 5,
    firstName: "Martin",
    lastName: "Procházka",
    email: "martin.p@example.com",
    phone: "+420777999000",
  },
  {
    id: 6,
    firstName: "Eva",
    lastName: "Kučerová",
    email: "eva.k@example.com",
    phone: "+420778111222",
  },
];

/** Fetch demo users from DummyJSON (cached per request via React fetch dedupe). */
export async function fetchDemoUsers(limit = 15): Promise<DummyUser[]> {
  try {
    const data = await httpRequest<{ users: DummyUser[] }>(
      `https://dummyjson.com/users?limit=${limit}&select=firstName,lastName,email,phone,image`,
      { timeoutMs: 6000 },
    );
    return data.users?.length ? data.users : FALLBACK_USERS;
  } catch {
    return FALLBACK_USERS;
  }
}

function userId(u: DummyUser): string {
  return `demo-${u.id}`;
}
function fullName(u: DummyUser): string {
  return `${u.firstName} ${u.lastName}`;
}

// Deterministic pickers keyed by index, so demo data is stable across renders.
const STATUSES: Reservation["status"][] = [
  "confirmed",
  "completed",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
];
const HOURS = [6, 7, 9, 12, 13, 16, 17, 18, 19, 20];

/** Build demo members (list view shape) over the Supabase `profiles` model. */
export function buildDemoMembers(
  users: DummyUser[],
  now = new Date(),
): MemberWithProfile[] {
  return users.map((u, i) => {
    const createdAt = addMinutes(now, -((i + 1) * 60 * 24 * 3));
    const role = i === 0 ? "admin" : "member";
    return {
      user: {
        id: userId(u),
        name: fullName(u),
        email: u.email,
        role,
        createdAt,
      },
      profile: {
        id: userId(u),
        email: u.email,
        fullName: fullName(u),
        role,
        phone: u.phone,
        phoneVerified: i % 3 !== 0,
        stripeCustomerId: null,
        notifyByWhatsapp: true,
        notifyBySms: i % 4 === 0,
        marketingConsent: i % 2 === 0,
        marketingConsentAt: null,
        termsAcceptedAt: now,
        note: null,
        createdAt,
        updatedAt: now,
      },
    };
  });
}

/** Build demo reservations spread across the recent past and near future. */
export function buildDemoReservations(
  users: DummyUser[],
  now = new Date(),
): Reservation[] {
  const rows: Reservation[] = [];
  let n = 0;
  // ~3 reservations per user across a -20…+5 day window.
  for (let d = -20; d <= 5; d++) {
    const u = users[Math.abs(d) % users.length]!;
    const hour = HOURS[Math.abs(d) % HOURS.length]!;
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    day.setHours(hour, 0, 0, 0);
    const startsAt = day;
    const endsAt = addMinutes(startsAt, 60);
    const isPast = startsAt.getTime() < now.getTime();
    let status = STATUSES[n % STATUSES.length]!;
    if (!isPast && (status === "completed" || status === "no_show"))
      status = "confirmed";
    rows.push({
      id: `demo-r-${n}`,
      userId: userId(u),
      startsAt,
      endsAt,
      status,
      contactName: fullName(u),
      contactEmail: u.email,
      contactPhone: u.phone,
      priceCents: n % 10 === 9 ? 0 : 29000,
      currency: "czk",
      createdByAdminId: null,
      cancelledAt: status === "cancelled" ? startsAt : null,
      cancelReason: status === "cancelled" ? "Zrušeno zákazníkem" : null,
      createdAt: addMinutes(startsAt, -60 * 24),
      updatedAt: now,
    });
    n++;
  }
  return rows.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

/** Demo message deliveries derived from reservations. */
export function buildDemoMessages(
  reservations: Reservation[],
): MessageDelivery[] {
  const channels: MessageDelivery["channel"][] = ["email", "whatsapp"];
  const out: MessageDelivery[] = [];
  reservations.slice(0, 25).forEach((r, i) => {
    channels.forEach((channel, c) => {
      const failed = i % 7 === 0 && channel === "whatsapp";
      out.push({
        id: `demo-m-${i}-${c}`,
        userId: r.userId,
        reservationId: r.id,
        channel,
        kind: "access_code",
        status: failed ? "failed" : channel === "email" ? "delivered" : "sent",
        recipient:
          channel === "email" ? (r.contactEmail ?? "") : (r.contactPhone ?? ""),
        providerMessageId: `demo-${i}-${c}`,
        providerResponse: null,
        failureReason: failed ? "Nedoručeno (ukázka)" : null,
        sentAt: r.createdAt,
        deliveredAt: failed ? null : r.createdAt,
        readAt: null,
        createdAt: r.createdAt,
        updatedAt: r.createdAt,
      });
    });
  });
  return out;
}

/** Demo entry-log (Nuki unlocks) for completed reservations. */
export function buildDemoEntries(reservations: Reservation[]): EntryLog[] {
  return reservations
    .filter((r) => r.status === "completed")
    .slice(0, 30)
    .map((r, i) => ({
      id: `demo-e-${i}`,
      reservationId: r.id,
      userId: r.userId,
      accessCodeId: null,
      nukiLogId: `demo-${i}`,
      nukiName: `${r.contactName} – kód`,
      action: "unlock",
      trigger: "keypad",
      occurredAt: addMinutes(r.startsAt, -5),
      createdAt: r.startsAt,
    }));
}

/** Demo stats computed from demo reservations (same aggregator as live). */
export function buildDemoStats(
  reservations: Reservation[],
  now = new Date(),
): Stats {
  return aggregateStats(
    reservations.map((r) => ({ startsAt: r.startsAt, status: r.status })),
    now,
  );
}

/**
 * Show demo data when a real query comes back empty. Returns the live rows plus
 * `demo: false` when there is real data, or the demo rows plus `demo: true`
 * otherwise : so a page reads `const { rows, demo } = await withDemoFallback(...)`
 * instead of repeating the empty-check everywhere.
 */
export async function withDemoFallback<T>(
  live: T[] | Promise<T[]>,
  pick: (demo: Awaited<ReturnType<typeof loadDemoData>>) => T[],
): Promise<{ rows: T[]; demo: boolean }> {
  let rows: T[] = [];
  try {
    rows = await live;
  } catch {
    // A showcase deployment intentionally runs without a database.
  }
  if (rows.length > 0) return { rows, demo: false };
  const data = await loadDemoData();
  return { rows: pick(data), demo: true };
}

/**
 * One-shot demo dataset. Call from a page when the real query is empty, then
 * render the returned collections with a demo banner.
 */
export async function loadDemoData(now = new Date()) {
  const users = await fetchDemoUsers(15);
  const members = buildDemoMembers(users, now);
  const reservations = buildDemoReservations(users, now);
  const messages = buildDemoMessages(reservations);
  const entries = buildDemoEntries(reservations);
  const stats = buildDemoStats(reservations, now);
  return { users, members, reservations, messages, entries, stats };
}
