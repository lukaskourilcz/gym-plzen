"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  clearDemoAdminSession,
  createDemoAdminSession,
  createDemoCustomerSession,
  isDemoIdentityEmail,
} from "@/lib/auth/demo";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/security/redirects";
import { takeRateLimit } from "@/lib/security/rate-limit";
import { publicEnv } from "@/lib/public-env";
import { passwordResetRequestSchema } from "@/lib/validations/auth";

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
    if (isDemoIdentityEmail(parsed.data.email)) {
      return { ok: false, error: "E-mail nebo heslo není správné." };
    }
  } else if (isDemoIdentityEmail(parsed.data.email)) {
    return { ok: false, error: "Registraci teď nelze dokončit." };
  }

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

/**
 * Trigger Supabase Auth's reset flow. The same response is intentionally
 * returned for unknown accounts, so this endpoint cannot be used to enumerate
 * members. Supabase delivers the actual e-mail through its configured SMTP.
 */
export async function requestPasswordResetAction(input: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte platný e-mail." };

  const requestHeaders = await headers();
  const source =
    requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (
    !takeRateLimit(
      "password-reset",
      `${source}:${parsed.data.email.toLowerCase()}`,
      { limit: 5, windowMs: 15 * 60 * 1000 },
    )
  ) {
    return {
      ok: false,
      error: "Příliš mnoho pokusů. Zkuste to znovu za několik minut.",
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Obnovu hesla teď nelze odeslat." };
  }

  const origin = new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin;
  try {
    // Deliberately discard Auth errors here. This keeps the response identical
    // for an unknown address and for a temporarily unavailable Auth provider.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
  } catch {
    // The generic success message below is part of the anti-enumeration policy.
  }
  return { ok: true };
}

export async function demoAdminLogoutAction() {
  await clearDemoAdminSession();
}
