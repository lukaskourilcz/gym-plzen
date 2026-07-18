import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions bodies can carry image/file uploads for the CMS.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Baseline security headers (verify with securityheaders.com / MDN Observatory).
  // A strict CSP is deferred until asset origins (Supabase, Stripe) are final —
  // see NEEDED.md.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

// Sentry wrapping is a no-op when SENTRY_* env vars are absent, so this is
// safe to keep enabled in every environment. See NEEDED.md for setup.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
});
