"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  clearDemoAdminSession,
  createDemoAdminSession,
  createDemoCustomerSession,
} from "@/lib/auth/demo";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/security/redirects";
import { takeRateLimit } from "@/lib/security/rate-limit";

const inputSchema = z.object({
  mode: z.enum(["signin", "signup"]),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  next: z.string().max(1000).optional(),
});

type AuthResult =
  | { ok: true; destination?: string; confirmationRequired?: boolean }
  | { ok: false; error: string };

export async function authenticateAction(input: unknown): Promise<AuthResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Zkontrolujte zadané údaje." };
  const requestHeaders = await headers();
  const clientId = `${requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}:${parsed.data.email.toLowerCase()}`;
  if (
    !takeRateLimit("auth", clientId, { limit: 8, windowMs: 10 * 60 * 1000 })
  ) {
    return {
      ok: false,
      error: "Příliš mnoho pokusů. Zkuste to znovu později.",
    };
  }

  const destination = safeInternalPath(parsed.data.next);
  if (parsed.data.mode === "signin") {
    if (await createDemoAdminSession(parsed.data.email, parsed.data.password)) {
      return { ok: true, destination: "/admin" };
    }
    if (
      await createDemoCustomerSession(parsed.data.email, parsed.data.password)
    ) {
      return { ok: true, destination: "/account" };
    }
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Přihlášení je dočasně nedostupné." };
  }

  if (parsed.data.mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return { ok: false, error: "E-mail nebo heslo není správné." };
    return { ok: true, destination };
  }

  if (!parsed.data.name?.trim()) return { ok: false, error: "Zadejte jméno." };
  const origin = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).origin;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name.trim() },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(destination)}`,
    },
  });
  if (error)
    return {
      ok: false,
      error: "Registraci teď nelze dokončit. Zkuste to později.",
    };
  return data.session
    ? { ok: true, destination }
    : { ok: true, confirmationRequired: true };
}

export async function demoAdminLogoutAction() {
  await clearDemoAdminSession();
}
