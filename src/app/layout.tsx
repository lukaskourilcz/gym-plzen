import type { Metadata } from "next";
import { Bitter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { publicEnv } from "@/lib/public-env";
import { DESIGN_VARIANT_INIT_SCRIPT } from "@/lib/config/design-variant";
import { AnalyticsConsentManager } from "@/components/site/analytics-consent";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

/** Self-hosted by Next with latin-ext so Czech diacritics match on every OS. */
const bitter = Bitter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "NAMASTÉ Private Gym | Privátní fitness v Plzni",
    template: "%s · NAMASTÉ Private Gym",
  },
  description:
    "Soukromý gym v Plzni s online rezervací, bezpečnou platbou a osobními pokyny ke vstupu.",
  openGraph: {
    title: "NAMASTÉ Private Gym | Privátní fitness v Plzni",
    description:
      "Soukromý gym v Plzni s online rezervací, bezpečnou platbou a osobními pokyny ke vstupu.",
    type: "website",
    locale: "cs_CZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * `suppressHydrationWarning`: the inline script below stamps `data-design`
     * on <html> before React hydrates, which is exactly the kind of
     * server/client attribute mismatch this opts out of.
     */
    <html lang="cs" className={bitter.variable} suppressHydrationWarning>
      <head>
        {/*
         * Applies the saved design variant before the first paint, so switching
         * never flashes the other look. Public pages stay ISR because the
         * cookie is read here in the browser, never on the server.
         */}
        <script
          dangerouslySetInnerHTML={{ __html: DESIGN_VARIANT_INIT_SCRIPT }}
        />
      </head>
      <body>
        <SkipLink />
        {children}
        <AnalyticsConsentManager />
        <Analytics />
      </body>
    </html>
  );
}
