"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, KeyRound, Mail, DoorOpen } from "lucide-react";
import { AdminMemberName } from "./member-name";
import { Badge } from "./ui/badge";
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
      {bookings.map((booking) => {
        const state = programmeProgress(booking, now);
        return (
          <article
            key={booking.id}
            role="listitem"
            data-reservation-id={booking.id}
            data-attendance={state.tone}
            className="admin-programme-row"
            style={
              { "--programme-progress": `${state.progress}%` } as CSSProperties
            }
          >
            <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-medium tabular-nums">
                {formatTimeRange(
                  new Date(booking.startsAt),
                  new Date(booking.endsAt),
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {state.label}
              </span>
            </div>
            <div className="relative mt-1 flex flex-wrap items-center gap-2">
              <AdminMemberName
                name={booking.name}
                note={booking.note}
                href={booking.memberHref}
              />
              {booking.free && <Badge variant="muted">Zdarma</Badge>}
            </div>
            <dl
              className="relative mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs"
              aria-label="Stav vstupního kódu"
            >
              <CodeState
                icon={KeyRound}
                label="Kód"
                done={booking.codeCreated}
                text={booking.codeCreated ? "Kód vytvořen" : "Kód nepřipraven"}
              />
              <CodeState
                icon={Mail}
                label="Odeslání"
                done={booking.codeSent}
                text={booking.codeSent ? "Kód odeslán" : "Kód neodeslán"}
              />
              <CodeState
                icon={DoorOpen}
                label="Použití"
                done={booking.codeUsed}
                text={booking.codeUsed ? "Kód použit" : "Kód zatím nepoužit"}
              />
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function CodeState({
  icon: Icon,
  label,
  done,
  text,
}: {
  icon: typeof KeyRound;
  label: string;
  done: boolean;
  text: string;
}) {
  const Status = done ? Check : Clock3;
  return (
    <div className="flex items-center gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="inline-flex items-center gap-1">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <Status
          className={
            done ? "size-3.5 text-primary" : "size-3.5 text-muted-foreground"
          }
          aria-hidden
        />
        {text}
      </dd>
    </div>
  );
}
