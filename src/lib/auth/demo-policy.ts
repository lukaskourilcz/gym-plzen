export function isDemoAuthEnabled(
  environment: {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
    DEMO_AUTH_ENABLED?: string;
  } = process.env,
): boolean {
  return (
    environment.DEMO_AUTH_ENABLED === "true" &&
    environment.NODE_ENV !== "production" &&
    environment.VERCEL_ENV !== "production"
  );
}
