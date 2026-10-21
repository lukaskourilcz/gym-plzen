import Link from "next/link";
import type { Announcement } from "@/lib/config/opening";

/**
 * One manually controlled announcement. Existing launch copy is resolved by
 * the content loader until an administrator first saves the single banner.
 */
export function OpeningBanner({
  announcement,
}: {
  announcement: Announcement;
}) {
  if (!announcement.enabled) return null;

  return (
    <aside
      aria-label="Otevření a akční vstupné"
      className="bg-gold px-4 py-3 text-center text-gold-foreground"
    >
      <Link
        href="/#cenik"
        className="block text-sm font-extrabold leading-6 sm:text-base"
      >
        {announcement.title}
      </Link>
      {announcement.showSecondLine && announcement.secondLine ? (
        <p className="mt-1 text-xs leading-5">{announcement.secondLine}</p>
      ) : null}
    </aside>
  );
}
