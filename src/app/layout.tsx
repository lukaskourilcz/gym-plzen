import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Gym Plzeň | Soukromé fitness",
    template: "%s · Gym Plzeň",
  },
  description:
    "Soukromé fitness v Plzni. Vyberte termín, zaplaťte online a vstupte pomocí osobního kódu.",
  openGraph: {
    title: "Gym Plzeň | Soukromé fitness",
    description:
      "Soukromé fitness v Plzni s online rezervací a vstupem pomocí osobního kódu.",
    type: "website",
    locale: "cs_CZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
