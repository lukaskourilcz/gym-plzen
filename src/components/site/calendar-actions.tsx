import { CalendarPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { googleCalendarUrl, reservationCalendarEvent } from "@/lib/helpers/ics";

/**
 * "Add to Google Calendar" for one confirmed reservation.
 *
 * The confirmation e-mail already carries the reservation as a `.ics`
 * attachment, which is what Apple Calendar and Outlook take, so the page
 * offers the one thing that attachment cannot do: open the prefilled event in
 * Google Calendar. A plain anchor on purpose: the link leaves the site.
 */
export function CalendarActions({
  reservationId,
  startsAt,
  endsAt,
  address,
  className,
  size = "sm",
}: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  address?: string | null;
  className?: string;
  size?: "sm" | "default";
}) {
  const event = reservationCalendarEvent({
    reservationId,
    startsAt,
    endsAt,
    address,
  });

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size }))}
      >
        <CalendarPlus aria-hidden="true" />
        Přidat do Google Kalendáře
        <span className="sr-only">(otevře se v novém okně)</span>
      </a>
    </div>
  );
}
