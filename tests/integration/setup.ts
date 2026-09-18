/**
 * Environment for the flow tests. Imported first by every integration test:
 * the application reads its configuration when its modules load, so the
 * database URL, the provider stand-ins and the deployment flags are settled
 * here, synchronously, before any service module is evaluated.
 *
 * The tests truncate booking tables. They therefore run only against a
 * database on this machine, or against one explicitly allowed with
 * `E2E_ALLOW_REMOTE_MUTATIONS=true` (the same consent the e2e suite requires),
 * and skip themselves otherwise.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { createComgateMock, createResendMock } from "./mocks";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const LOCAL_DATABASE =
  /^postgres(?:ql)?:\/\/[^/@]+@(?:127\.0\.0\.1|localhost)(?::\d+)?\//;
export const databaseReady =
  Boolean(url) &&
  (LOCAL_DATABASE.test(url) ||
    process.env.E2E_ALLOW_REMOTE_MUTATIONS === "true");
if (databaseReady) process.env.DATABASE_URL = url;
else delete process.env.DATABASE_URL;

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
for (const key of [
  "VERCEL_ENV",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "ALERT_WHATSAPP_RECIPIENTS",
  "WHATSAPP_ACCESS_TOKEN",
  "NUKI_API_TOKEN",
  "NUKI_SMARTLOCK_ID",
  "GOSMS_CLIENT_ID",
  "DEMO_AUTH_ENABLED",
  "BOOKING_PREVIEW_FIXTURE",
])
  delete process.env[key];

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

const BOOKING_TABLES = [
  "reservation_reschedule",
  "reservation_pipeline",
  "message_delivery",
  "access_code",
  "entry_log",
  "invoice",
  "document_counter",
  "voucher_redemption",
  "voucher",
  "payment",
  "webhook_event",
  "system_alert",
  "blocked_slot",
  "pricing_period",
  "reservation",
  "membership",
  "membership_plan",
];

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
  resend.sent.length = 0;
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
