/**
 * Environment for the flow tests. Imported first by every integration test:
 * the application reads its configuration when its modules load, so the
 * database URL, the provider stand-ins and the deployment flags are settled
 * here, synchronously, before any service module is evaluated.
 *
 * The tests truncate booking tables. They therefore run only against a
 * database on this machine named in `TEST_DATABASE_URL`, and skip themselves
 * otherwise (or fail with `REQUIRE_DB=1`, so an empty run cannot look green).
 */
import postgres from "postgres";
import { createComgateMock, createResendMock } from "./mocks";
import { isTestDatabaseUrl } from "../helpers/test-database";
import { BOOKING_TABLES } from "../helpers/booking-tables";

/*
 * Only an explicitly named database on this machine is ever truncated. The
 * application's own DATABASE_URL (which `.env.local` may point at the live
 * project) is never used as a fallback, and there is no remote override.
 */
const url = process.env.TEST_DATABASE_URL ?? "";
export const databaseReady = isTestDatabaseUrl(url);
if (!databaseReady && process.env.REQUIRE_DB === "1")
  throw new Error(
    "REQUIRE_DB=1 but TEST_DATABASE_URL is not a local Postgres URL; refusing to report a skipped suite as green.",
  );
if (databaseReady) process.env.DATABASE_URL = url;
else delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;

/* Provider stand-ins on ports derived from the process, so parallel runs
 * cannot collide; both must be known before the provider modules load.
 * `npm run test:integration` additionally runs one file at a time, because
 * every file truncates the same database (see `resetDatabase`). */
const base = 40_000 + (process.pid % 10_000);
export const RESEND_PORT = base;
export const COMGATE_PORT = base + 1;
process.env.RESEND_BASE_URL = `http://127.0.0.1:${RESEND_PORT}`;
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM_EMAIL = "NAVI Private Gym <noreply@example.test>";
process.env.COMGATE_API_URL = `http://127.0.0.1:${COMGATE_PORT}/v2.0`;
process.env.COMGATE_MERCHANT_ID = "test-merchant";
process.env.COMGATE_SECRET = "test-secret";
process.env.COMGATE_TEST_MODE = "true";
process.env.NEXT_PUBLIC_APP_URL = "https://navigym.test";
// `NODE_ENV` is typed read-only; the test runner's process is ours to configure.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
// Every real provider credential goes, whatever `.env.local` holds: a test
// must never reach a live lock, inbox, phone or project.
for (const key of Object.keys(process.env))
  if (
    /^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|NUKI_|ZERNIO_|WHATSAPP_|GOSMS_|STRIPE_|SENTRY_|NEXT_PUBLIC_SENTRY_|UPTIMEROBOT_|ALERT_|CRON_SECRET|VERCEL_|DEMO_AUTH_|BOOKING_PREVIEW_)/.test(
      key,
    )
  )
    delete process.env[key];

/*
 * Network kill-switch: the only hosts a test may reach are the local
 * stand-ins. Anything else is a bug that would otherwise send a real e-mail or
 * touch a real device, so it fails loudly instead.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const target = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!["127.0.0.1", "localhost"].includes(target.hostname))
    throw new Error(`Test tried to reach ${target.hostname}; blocked.`);
  return realFetch(input, init);
}) as typeof fetch;

const { DEFAULT_OPERATOR_NOTIFICATIONS, OPERATOR_NOTIFICATIONS_SETTING_KEY } =
  await import("../../src/lib/config/operator-notifications");

export const resend = createResendMock(RESEND_PORT);
export const comgate = createComgateMock(COMGATE_PORT);

const sql = databaseReady ? postgres(url, { prepare: false, max: 2 }) : null;

export async function startProviders(): Promise<void> {
  await Promise.all([resend.start(), comgate.start()]);
}

export async function stopEverything(): Promise<void> {
  await Promise.all([resend.stop(), comgate.stop()]);
  await sql?.end({ timeout: 2 });
}

/**
 * Empty everything a booking touches; keep opening hours, content, settings.
 * Profiles are deleted rather than truncated: content and settings rows point
 * at their editor, and a cascading truncate would take the seed with them.
 */
export async function resetDatabase(): Promise<void> {
  if (!sql) throw new Error("database not configured");
  await sql.unsafe(
    `TRUNCATE ${BOOKING_TABLES.map((t) => `public.${t}`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  await sql`delete from public.profiles`;
  await setSetting("booking.operations", {
    paymentsEnabled: true,
    bookingsFrom: "",
    accessCodesEnabled: false,
  });
  await setSetting("pricing.entry_price_cents", 22_900);
  await setSetting("billing.send_documents", false);
  // Test cases may edit the CMS between provider retries. A new case must
  // start with the shipping templates, just like the rest of its fixtures.
  await setSetting("messages.email.reservation_confirmation", null);
  await setSetting("messages.email.order_confirmation", null);
  // The operator's own notifications are on by default in production and have
  // their own suite; here they would add a second recipient to every booking
  // and blur what the customer actually received.
  await setSetting(OPERATOR_NOTIFICATIONS_SETTING_KEY, {
    recipients: "",
    events: DEFAULT_OPERATOR_NOTIFICATIONS.events,
  });
  resend.reset();
  comgate.creates.length = 0;
  comgate.payments.clear();
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!sql) throw new Error("database not configured");
  await sql`insert into public.site_setting (key, value, updated_at)
    values (${key}, ${sql.json(value as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function seedProfile(profile: {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}): Promise<void> {
  if (!sql) throw new Error("database not configured");
  await sql`insert into public.profiles (id, email, full_name, phone, role)
    values (${profile.id}, ${profile.email}, ${profile.fullName}, ${profile.phone ?? null}, 'member')`;
}

export async function seedVoucher(voucher: {
  code: string;
  kind: "percentage" | "fixed_amount";
  value: number;
  maxRedemptions?: number | null;
  isActive?: boolean;
}): Promise<void> {
  if (!sql) throw new Error("database not configured");
  await sql`insert into public.voucher (code, kind, value, max_redemptions, is_active)
    values (${voucher.code}, ${voucher.kind}, ${voucher.value}, ${voucher.maxRedemptions ?? null}, ${voucher.isActive ?? true})`;
}

/** Raw rows for assertions; the application's own reads stay under test. */
export async function rows<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!sql) throw new Error("database not configured");
  return sql.unsafe(query, params as never[]) as unknown as Promise<T[]>;
}
