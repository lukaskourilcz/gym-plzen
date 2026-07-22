import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { publicEnv } from "@/lib/public-env";
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
    "Plně samoobslužné privátní fitness v Plzni. Rezervace online a vstup pomocí osobního kódu.",
  openGraph: {
    title: "NAMASTÉ Private Gym | Privátní fitness v Plzni",
    description:
      "Plně samoobslužné privátní fitness v Plzni s online rezervací a osobním vstupním kódem.",
    type: "website",
    locale: "cs_CZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
