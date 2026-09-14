"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { openingAnnouncement } from "@/lib/config/opening";

export function OpeningBanner() {
  const [message, setMessage] = useState(() => openingAnnouncement(new Date()));
  useEffect(() => {
    const update = () => setMessage(openingAnnouncement(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!message) return null;
  return (
    <aside
      aria-label="Otevření a akční vstupné"
      className="bg-gold px-4 py-3 text-center text-gold-foreground"
    >
      <Link
        href="/#cenik"
        className="block text-sm font-extrabold leading-6 sm:text-base"
      >
        {message}
      </Link>
      <p className="mt-1 text-xs leading-5">
        Cena podle data nákupu: v říjnu 199 Kč, v listopadu a prosinci 229 Kč za
        vstup.
      </p>
    </aside>
  );
}
