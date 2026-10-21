"use client";
import { Analytics } from "@vercel/analytics/next";
/** Synthetic walkthroughs must not appear in acquisition or purchase reports. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) =>
        new URL(event.url).pathname === "/customer-preview" ? null : event
      }
    />
  );
}
