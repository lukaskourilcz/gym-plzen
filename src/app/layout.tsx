import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { publicEnv } from "@/lib/public-env";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
    <html lang="cs" className={manrope.variable}>
      <body>
        <SkipLink />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
