"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, Mail, DoorOpen } from "lucide-react";
import { AdminMemberName } from "./member-name";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { formatTimeRange } from "@/lib/helpers/format";
import { programmeProgress } from "@/lib/helpers/programme-progress";

export interface ProgrammeBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  name: string;
  memberHref?: string;
  note?: string;
  free: boolean;
  codeCreated: boolean;
  codeSent: boolean;
  codeUsed: boolean;
}

export function DailyProgramme({
  bookings,
  initialNow,
}: {
  bookings: ProgrammeBooking[];
  initialNow: number;
}) {
  const [now, setNow] = useState(initialNow);
  const router = useRouter();
  useEffect(() => {
    const clock = setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 15_000);
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  if (!bookings.length)
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Na dnešek nemáte žádnou rezervaci.
      </p>
    );
  return (
    <div data-ui="programme-list" role="list" aria-label="Dnešní program">
      {bookings.map((booking) => (
        <DailyProgrammeRow key={booking.id} booking={booking} now={now} />
      ))}
    </div>
  );
}

export function DailyProgrammeRow({
  booking,
  now,
}: {
  booking: ProgrammeBooking;
  now: number;
}) {
  const state = programmeProgress(booking, now);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? state.tone !== "success";
  const detailsId = useId();
  const time = formatTimeRange(
    new Date(booking.startsAt),
    new Date(booking.endsAt),
  );
  const codes = [
    {
      icon: KeyRound,
      done: booking.codeCreated,
      label: booking.codeCreated ? "Kód vytvořen" : "Kód nepřipraven",
      description: booking.codeCreated
        ? "Kód vytvořen pro tento termín."
        : "Kód zatím není připraven pro tento termín.",
    },
    {
      icon: Mail,
      done: booking.codeSent,
      label: booking.codeSent ? "Kód odeslán" : "Kód neodeslán",
      description: booking.codeSent
        ? "Kód odeslán zákazníkovi."
        : "Kód zatím nebyl odeslán. Odesílá se hodinu před začátkem.",
    },
    {
      icon: DoorOpen,
      done: booking.codeUsed,
      label: booking.codeUsed ? "Kód použit" : "Kód zatím nepoužit",
      description: booking.codeUsed
        ? "Kód použit při odemčení zámku."
        : "Použití kódu při odemčení zatím nebylo zaznamenáno.",
    },
  ];
  return (
    <article
      role="listitem"
      data-reservation-id={booking.id}
      data-attendance={state.tone}
      className="admin-programme-row"
      style={{ "--programme-progress": `${state.progress}%` } as CSSProperties}
    >
      <div className="admin-programme-heading relative">
        <span className="whitespace-nowrap text-xs font-medium tabular-nums sm:text-[13px]">
          {time}
        </span>
        <div className="min-w-0" title={booking.name}>
          <AdminMemberName
            className="admin-programme-name"
            name={booking.name}
            note={booking.note}
            href={booking.memberHref}
          />
        </div>
        <span
          className="inline-flex items-center gap-1.5"
          aria-label="Stav vstupního kódu"
        >
          {codes.map(({ icon: Icon, label, done }) => (
            <span
              key={label}
              role="img"
              aria-label={label}
              title={label}
              className={done ? "text-primary" : "text-muted-foreground"}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
          ))}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Podrobnosti rezervace: ${booking.name}, ${time}`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setManualExpanded(!expanded)}
        >
          <ChevronDown
            className={expanded ? "rotate-180" : undefined}
            aria-hidden
          />
        </Button>
      </div>
      <div
        id={detailsId}
        hidden={!expanded}
        className="relative border-t border-border/60 px-3 pb-3 pt-2"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{state.label}</span>
          {booking.free && <Badge variant="muted">Zdarma</Badge>}
        </div>
        <dl
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs"
          aria-label="Podrobnosti vstupního kódu"
        >
          {codes.map(({ icon: Icon, label, description, done }) => (
            <div key={label} className="flex min-w-0 items-start gap-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className="flex items-start gap-1.5">
                <Icon
                  className={
                    done
                      ? "mt-0.5 size-3.5 shrink-0 text-primary"
                      : "mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  }
                  aria-hidden
                />
                <span>{description}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
