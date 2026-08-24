import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { publicEnv } from "@/lib/public-env";
import { AnalyticsConsentManager } from "@/components/site/analytics-consent";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

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
    <html lang="cs">
      <body>
        <SkipLink />
        {children}
        <AnalyticsConsentManager />
        <Analytics />
      </body>
    </html>
  );
}
