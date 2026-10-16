import Link from "next/link";
import { incidentPresentation } from "@/lib/helpers/incident-presentation";
import { formatDateTime } from "@/lib/helpers/format";

/** One presentation for alert history, the daily dashboard and the UI gallery. */
export function IncidentDetails({
  alert,
  compact = false,
}: {
  alert: {
    title: string;
    body: string | null;
    context: unknown;
    resolvedAt?: Date | null;
  };
  compact?: boolean;
}) {
  const view = incidentPresentation(alert),
    incident = view.incident;
  return (
    <div className="space-y-2 text-sm">
      <div className="font-semibold leading-snug">{view.title}</div>
      {incident ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatDateTime(new Date(incident.startsAt))}
          </span>
          {" · "}
          {incident.customerName ?? "Zákazník bez uvedeného jména"}
          {" · "}
          {view.phase}
        </p>
      ) : view.phase ? (
        <p className="text-xs text-muted-foreground">{view.phase}</p>
      ) : null}
      {view.cause ? (
        <p
          className={
            compact
              ? "line-clamp-2 text-muted-foreground"
              : "text-muted-foreground whitespace-pre-line"
          }
        >
          {view.cause}
        </p>
      ) : null}
      {!compact && view.impact ? <p>{view.impact}</p> : null}
      {!compact && view.action ? (
        <p>
          <span className="font-medium">Co udělat: </span>
          {view.action}
        </p>
      ) : null}
      {!compact && view.legacy ? (
        <p className="text-xs text-muted-foreground">
          Starší záznam: přesná příčina nebyla zachycena. Z tohoto hlášení nelze
          určit, zda chyběl kontakt zákazníka.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-primary">
        {view.reservationHref ? (
          <Link
            className="inline-flex min-h-8 items-center underline-offset-4 hover:underline"
            href={view.reservationHref}
          >
            Otevřít rezervaci
          </Link>
        ) : null}
        {!compact && view.memberHref ? (
          <Link
            className="inline-flex min-h-8 items-center underline-offset-4 hover:underline"
            href={view.memberHref}
          >
            Profil zákazníka
          </Link>
        ) : null}
        {!compact && view.messagesHref ? (
          <Link
            className="inline-flex min-h-8 items-center underline-offset-4 hover:underline"
            href={view.messagesHref}
          >
            Související zprávy
          </Link>
        ) : null}
        {compact ? (
          <Link
            className="inline-flex min-h-8 items-center underline-offset-4 hover:underline"
            href={
              view.reservationId
                ? `/admin/alerts?q=${view.reservationId}`
                : "/admin/alerts"
            }
          >
            Podrobnosti incidentu
          </Link>
        ) : null}
      </div>
      {!compact && incident ? (
        <p className="text-xs text-muted-foreground">
          Zachyceno naposledy {formatDateTime(new Date(incident.lastSeenAt))}
          {incident.attempts > 0
            ? ` · Pokusy: ${incident.attempts}`
            : " · Kontrola před odesláním"}
          {!alert.resolvedAt && incident.nextRetryAt
            ? ` · Další automatická kontrola: ${formatDateTime(new Date(incident.nextRetryAt))}`
            : ""}
        </p>
      ) : null}
      {!compact && (view.technical || incident || view.reservationId) ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1 font-medium">
            Technické podrobnosti
          </summary>
          <div className="mt-2 space-y-1 break-words">
            {incident ? (
              <p>
                Druh chyby: {incident.code} · Krok: {incident.step}
              </p>
            ) : null}
            {view.reservationId ? <p>Rezervace: {view.reservationId}</p> : null}
            {view.technical ? (
              <p className="whitespace-pre-wrap">{view.technical}</p>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
