import "./_env";

// Read-only preflight: prints variable names and verdicts, never values.
// Presence/shape cannot prove validity, permissions or delivery at a provider.
const value = (name: string) => process.env[name]?.trim() ?? "";
const checks: Array<{ check: string; passed: boolean }> = [];
const add = (check: string, passed: boolean) => checks.push({ check, passed });
const present = (name: string) => {
  const text = value(name);
  return (
    Boolean(text) &&
    !/\.\.\.|<ref>|<password>|generate-at-least|placeholder/i.test(text)
  );
};
const url = (name: string) => {
  try {
    return new URL(value(name));
  } catch {
    return null;
  }
};
const app = url("NEXT_PUBLIC_APP_URL");
add(
  "NEXT_PUBLIC_APP_URL: production HTTPS origin",
  app?.protocol === "https:" &&
    !/localhost|127\.0\.0\.1/.test(app.hostname) &&
    app.pathname === "/",
);
add(
  "DATABASE_URL: configured Postgres connection",
  present("DATABASE_URL") &&
    /^(postgres|postgresql):$/.test(url("DATABASE_URL")?.protocol ?? ""),
);
add(
  "DIRECT_URL: migration connection",
  present("DIRECT_URL") &&
    /^(postgres|postgresql):$/.test(url("DIRECT_URL")?.protocol ?? ""),
);
const supabase = url("NEXT_PUBLIC_SUPABASE_URL");
add(
  "NEXT_PUBLIC_SUPABASE_URL: configured HTTPS project",
  present("NEXT_PUBLIC_SUPABASE_URL") && supabase?.protocol === "https:",
);
add(
  "SUPABASE_URL: same project when alias is set",
  !value("SUPABASE_URL") || url("SUPABASE_URL")?.origin === supabase?.origin,
);
const publicKey =
  value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
  value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const secretKey =
  value("SUPABASE_SECRET_KEY") || value("SUPABASE_SERVICE_ROLE_KEY");
function jwtRole(key: string): string | undefined {
  try {
    return JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString(),
    ).role;
  } catch {
    return undefined;
  }
}
add(
  "Supabase browser key: publishable/anon, never secret",
  !publicKey.includes("...") &&
    (publicKey.startsWith("sb_publishable_") || jwtRole(publicKey) === "anon"),
);
add(
  "Supabase server key: secret/service_role",
  !secretKey.includes("...") &&
    (secretKey.startsWith("sb_secret_") ||
      jwtRole(secretKey) === "service_role"),
);
add(
  "SUPABASE_PUBLISHABLE_KEY: matches browser alias when set",
  !value("SUPABASE_PUBLISHABLE_KEY") ||
    value("SUPABASE_PUBLISHABLE_KEY") === publicKey,
);
add(
  "STRIPE_SECRET_KEY: live mode",
  present("STRIPE_SECRET_KEY") &&
    /^(sk|rk)_live_/.test(value("STRIPE_SECRET_KEY")),
);
add(
  "STRIPE_WEBHOOK_SECRET: signing secret",
  present("STRIPE_WEBHOOK_SECRET") &&
    value("STRIPE_WEBHOOK_SECRET").startsWith("whsec_"),
);
add(
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: live mode when set",
  !value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ||
    value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_"),
);
for (const name of [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NUKI_API_TOKEN",
  "NUKI_SMARTLOCK_ID",
])
  add(`${name}: present`, present(name));
for (const name of ["NUKI_WEBHOOK_SECRET", "CRON_SECRET"])
  add(
    `${name}: at least 32 characters`,
    present(name) && value(name).length >= 32,
  );
add(
  "SUPABASE_MANAGEMENT_API_TOKEN: admin Auth-template synchronization",
  present("SUPABASE_MANAGEMENT_API_TOKEN"),
);
add(
  "Production demo flags disabled",
  value("DEMO_AUTH_ENABLED") !== "true" &&
    value("BOOKING_PREVIEW_FIXTURE") !== "true",
);
console.table(
  checks.map(({ check, passed }) => ({
    check,
    status: passed ? "PASS" : "FAIL",
  })),
);
console.log(
  "Read-only configuration check. Provider validity, webhook destinations, SMTP, DNS and physical lock tests still require verification.",
);
process.exitCode = checks.every((check) => check.passed) ? 0 : 1;
