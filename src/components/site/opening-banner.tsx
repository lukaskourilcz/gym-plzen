import Link from "next/link";
import { openingAnnouncement } from "@/lib/config/opening";

/**
 * Launch banner under the hero calendar. The text follows the Prague calendar
 * through `openingAnnouncement`: pre-launch, October, November/December, then
 * nothing. The homepage is ISR (`revalidate = 60`), so a change of phase shows
 * within a minute without a deployment.
 */
export function OpeningBanner({ at }: { at: Date }) {
  const announcement = openingAnnouncement(at);
  if (!announcement) return null;

  return (
    <aside
      aria-label="Otevření a akční vstupné"
      className="bg-gold px-4 py-3 text-center text-gold-foreground"
    >
      <Link
        href="/#cenik"
        className="block text-sm font-extrabold leading-6 sm:text-base"
      >
        {announcement}
      </Link>
      <p className="mt-1 text-xs leading-5">
        Zarezervujte si svůj termín již teď.
      </p>
    </aside>
  );
}
