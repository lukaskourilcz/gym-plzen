import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { publicEnv } from "@/lib/env";
import { PreviewRibbon } from "@/components/preview-ribbon";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Gym Plzeň — soukromý gym jen pro vás",
    template: "%s · Gym Plzeň",
  },
  description:
    "Rezervujte si celý gym jen pro sebe, zaplaťte online a dveře si otevřete jednorázovým kódem. Bez recepce, bez čekání.",
  openGraph: {
    title: "Gym Plzeň — soukromý gym jen pro vás",
    description:
      "Rezervujte si celý gym jen pro sebe, zaplaťte online a odemkněte jednorázovým kódem.",
    type: "website",
    locale: "cs_CZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={inter.variable}>
      <body>
        {children}
        <PreviewRibbon />
      </body>
    </html>
  );
}
