import { cookies } from "next/headers";

export const DEMO_ADMIN_EMAIL = "admin@namaste.demo";
export const DEMO_ADMIN_PASSWORD = "namaste2026";
const DEMO_ADMIN_COOKIE = "namaste_demo_admin";
const DEMO_ADMIN_SESSION = "showcase-access";

export async function hasDemoAdminSession(): Promise<boolean> {
  return (await cookies()).get(DEMO_ADMIN_COOKIE)?.value === DEMO_ADMIN_SESSION;
}

export async function createDemoAdminSession(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== DEMO_ADMIN_EMAIL || password !== DEMO_ADMIN_PASSWORD) return false;

  (await cookies()).set(DEMO_ADMIN_COOKIE, DEMO_ADMIN_SESSION, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return true;
}

export async function clearDemoAdminSession(): Promise<void> {
  (await cookies()).delete(DEMO_ADMIN_COOKIE);
}
