const RESERVED_DEMO_EMAILS = new Set([
  "admin@namaste.demo",
  "klient@namaste.demo",
]);

export function isProductionDeployment(
  environment: { NODE_ENV?: string; VERCEL_ENV?: string } = process.env,
): boolean {
  return (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  );
}

/** Demo identities are local fixtures and must never authenticate in production. */
export function isReservedDemoEmail(email?: string | null): boolean {
  return RESERVED_DEMO_EMAILS.has(email?.trim().toLowerCase() ?? "");
}

export function isDemoAuthEnabled(
  environment: {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
    DEMO_AUTH_ENABLED?: string;
  } = process.env,
): boolean {
  return (
    environment.DEMO_AUTH_ENABLED === "true" &&
    !isProductionDeployment(environment)
  );
}
