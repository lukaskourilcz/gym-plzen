import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isDemoAuthEnabled } from "./demo-policy";

export const DEMO_ADMIN_EMAIL = "admin@namaste.demo";
const DEMO_ADMIN_PASSWORD = "namaste2026";
export const DEMO_CUSTOMER_EMAIL = "klient@namaste.demo";
const DEMO_CUSTOMER_PASSWORD = "namaste2026";
export const DEMO_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_ADMIN_COOKIE = "namaste_demo_admin";
const DEMO_CUSTOMER_COOKIE = "namaste_demo_customer";
const DEV_SIGNING_SECRET = "namaste-local-demo-cookie-signing-secret-v2";

/** Reserved fixtures must never fall through to a real Supabase login. */
export function isDemoIdentityEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email === DEMO_ADMIN_EMAIL || email === DEMO_CUSTOMER_EMAIL;
}

function sign(role: "admin" | "customer", expiresAt: number) {
  const payload = `${role}.${expiresAt}`;
  const signature = createHmac(
    "sha256",
    process.env.DEMO_AUTH_SECRET || DEV_SIGNING_SECRET,
  )
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

function verify(value: string | undefined, role: "admin" | "customer") {
  if (!value || !isDemoAuthEnabled()) return false;
  const [tokenRole, expiresAtRaw, received] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (
    tokenRole !== role ||
    !received ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  )
    return false;
  const expected = sign(role, expiresAt).split(".").at(-1)!;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function hasDemoAdminSession(): Promise<boolean> {
  return verify((await cookies()).get(DEMO_ADMIN_COOKIE)?.value, "admin");
}

export async function hasDemoCustomerSession(): Promise<boolean> {
  return verify((await cookies()).get(DEMO_CUSTOMER_COOKIE)?.value, "customer");
}

async function createDemoSession(
  role: "admin" | "customer",
  email: string,
  password: string,
) {
  if (!isDemoAuthEnabled()) return false;
  const expectedEmail =
    role === "admin" ? DEMO_ADMIN_EMAIL : DEMO_CUSTOMER_EMAIL;
  const expectedPassword =
    role === "admin" ? DEMO_ADMIN_PASSWORD : DEMO_CUSTOMER_PASSWORD;
  if (
    email.trim().toLowerCase() !== expectedEmail ||
    password !== expectedPassword
  )
    return false;

  const cookieStore = await cookies();
  cookieStore.delete(
    role === "admin" ? DEMO_CUSTOMER_COOKIE : DEMO_ADMIN_COOKIE,
  );
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  cookieStore.set(
    role === "admin" ? DEMO_ADMIN_COOKIE : DEMO_CUSTOMER_COOKIE,
    sign(role, expiresAt),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    },
  );
  return true;
}

export function createDemoAdminSession(email: string, password: string) {
  return createDemoSession("admin", email, password);
}

export function createDemoCustomerSession(email: string, password: string) {
  return createDemoSession("customer", email, password);
}

export async function clearDemoAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_ADMIN_COOKIE);
  cookieStore.delete(DEMO_CUSTOMER_COOKIE);
}
