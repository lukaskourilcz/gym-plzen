import { cookies } from "next/headers";

export const DEMO_ADMIN_EMAIL = "admin@namaste.demo";
export const DEMO_ADMIN_PASSWORD = "namaste2026";
export const DEMO_CUSTOMER_EMAIL = "klient@namaste.demo";
export const DEMO_CUSTOMER_PASSWORD = "namaste2026";
export const DEMO_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_ADMIN_COOKIE = "namaste_demo_admin";
const DEMO_CUSTOMER_COOKIE = "namaste_demo_customer";
const DEMO_ADMIN_SESSION = "showcase-access";
const DEMO_CUSTOMER_SESSION = "customer-showcase-access";

export async function hasDemoAdminSession(): Promise<boolean> {
  return (await cookies()).get(DEMO_ADMIN_COOKIE)?.value === DEMO_ADMIN_SESSION;
}

export async function hasDemoCustomerSession(): Promise<boolean> {
  return (await cookies()).get(DEMO_CUSTOMER_COOKIE)?.value === DEMO_CUSTOMER_SESSION;
}

export async function createDemoAdminSession(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== DEMO_ADMIN_EMAIL || password !== DEMO_ADMIN_PASSWORD) return false;

  const cookieStore = await cookies();
  cookieStore.delete(DEMO_CUSTOMER_COOKIE);
  cookieStore.set(DEMO_ADMIN_COOKIE, DEMO_ADMIN_SESSION, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return true;
}

export async function createDemoCustomerSession(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== DEMO_CUSTOMER_EMAIL || password !== DEMO_CUSTOMER_PASSWORD) return false;

  const cookieStore = await cookies();
  cookieStore.delete(DEMO_ADMIN_COOKIE);
  cookieStore.set(DEMO_CUSTOMER_COOKIE, DEMO_CUSTOMER_SESSION, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return true;
}

export async function clearDemoAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_ADMIN_COOKIE);
  cookieStore.delete(DEMO_CUSTOMER_COOKIE);
}
