"use server";

import {
  clearDemoAdminSession,
  createDemoAdminSession,
  createDemoCustomerSession,
} from "@/lib/auth/demo";

export async function demoAdminLoginAction(input: { email: string; password: string }) {
  const ok = await createDemoAdminSession(input.email, input.password);
  return ok ? { ok: true as const } : { ok: false as const, error: "Neplatný e-mail nebo heslo." };
}

export async function demoCustomerLoginAction(input: { email: string; password: string }) {
  const ok = await createDemoCustomerSession(input.email, input.password);
  return ok ? { ok: true as const } : { ok: false as const, error: "Neplatný e-mail nebo heslo." };
}

export async function demoAdminLogoutAction() {
  await clearDemoAdminSession();
}
