import { CalendarPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { googleCalendarUrl, reservationCalendarEvent } from "@/lib/helpers/ics";

/**
 * "Add to calendar" for one confirmed reservation: a downloadable .ics for
 * Apple/Outlook and a Google Calendar template link.
 *
 * Plain anchors on purpose: the .ics is served with a `Content-Disposition`
 * attachment header, which the router would otherwise try to navigate to, and
 * the Google link leaves the site entirely.
 */
export function CalendarActions({
  reservationId,
  startsAt,
  endsAt,
  address,
  token,
  className,
  size = "sm",
}: {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  address?: string | null;
  /** Passed through so a guest keeps the same proof of access the page used. */
  token?: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const event = reservationCalendarEvent({
    reservationId,
    startsAt,
    endsAt,
    address,
  });
  const icsHref = token
    ? `/api/reservations/${reservationId}/calendar.ics?token=${encodeURIComponent(token)}`
    : `/api/reservations/${reservationId}/calendar.ics`;
  const classes = cn(buttonVariants({ variant: "outline", size }));

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a href={icsHref} className={classes}>
        <CalendarPlus aria-hidden="true" />
        Přidat do kalendáře
      </a>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        Google Kalendář
        <span className="sr-only">(otevře se v novém okně)</span>
      </a>
    </div>
  );
}
