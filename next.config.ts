import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const scriptSources = [
  "script-src 'self' 'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  "https://js.stripe.com",
  "https://www.googletagmanager.com",
  "https://connect.facebook.net",
  "https://*.googleapis.com",
  "https://*.gstatic.com",
  "https://*.google.com",
  "https://*.ggpht.com",
  "https://*.googleusercontent.com",
  "blob:",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  scriptSources,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://static.wixstatic.com https://*.supabase.co https://www.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com",
  "connect-src 'self' data: blob: https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.ingest.sentry.io https://www.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googleapis.com https://*.google.com https://*.gstatic.com",
  "frame-src https://*.google.com https://maps.google.com https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions bodies can carry image/file uploads for the CMS.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wixstatic.com" },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
  webpack: { treeshake: { removeDebugLogging: true } },
});
