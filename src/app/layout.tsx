import type { Metadata } from "next";
import { Bitter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { publicEnv } from "@/lib/public-env";
import { AnalyticsConsentManager } from "@/components/site/analytics-consent";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

/** Bitter carries the whole brand; latin-ext keeps Czech diacritics correct. */
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
    <html lang="cs" className={bitter.variable}>
      <body>
        <SkipLink />
        {children}
        <AnalyticsConsentManager />
        <Analytics />
      </body>
    </html>
  );
}
