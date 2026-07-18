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
};

// Sentry wrapping is a no-op when SENTRY_* env vars are absent, so this is
// safe to keep enabled in every environment. See NEEDED.md for setup.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
});
