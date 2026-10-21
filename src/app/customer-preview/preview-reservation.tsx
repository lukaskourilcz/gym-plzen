"use client";

import { useState } from "react";
import { ReservationCardView } from "@/components/site/reservation-card-view";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cancellationPrice } from "@/lib/config/customer-cancellation";
import {
  getRescheduleEligibility,
  rescheduleReasonMessage,
} from "@/lib/config/rescheduling";
import { participantSurcharge } from "@/lib/config/participants";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { formatDateTime } from "@/lib/helpers/format";
import {
  previewCalendar,
  type CustomerPreviewConfig,
  type previewSelection,
} from "@/lib/helpers/customer-preview";

export type PreviewSlot = ReturnType<typeof previewSelection>[number] & {
  isReward?: boolean;
};
export type PreviewReservation = PreviewSlot & {
  id: string;
  status: "confirmed" | "cancelled";
  changed: boolean;
};

/** Simulations only: no server actions, provider integrations or live availability. */
export function PreviewReservationCard({
  slot,
  extraPeople,
  config,
  purchased,
  onCancel,
  onChange,
}: {
  slot: PreviewReservation;
  extraPeople: number;
  config: CustomerPreviewConfig;
  purchased: ReadonlySet<string>;
  onCancel: (id: string) => void;
  onChange: (id: string, startISO: string) => void;
}) {
  const [dialog, setDialog] = useState<"cancel" | "change" | null>(null);
  const [date, setDate] = useState(() =>
    dateKeyInTimeZone(new Date(slot.startISO)),
  );
  const [replacement, setReplacement] = useState<string | null>(null);
  const now = new Date(config.nowISO);
  const startsAt = new Date(slot.startISO);
  const reservation = {
    id: slot.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + slot.durationMinutes * 60_000),
    status: slot.status,
    priceCents: slot.priceCents,
    currency: "czk",
    loyaltyReward: slot.isReward ? 1 : null,
    additionalPeoplePaidCents: config.participants.enabled
      ? participantSurcharge(extraPeople, config.participants)
      : 0,
    cancelReason: null,
    extraPeople,
  };
  const amount = cancellationPrice(reservation);
  const eligibility = getRescheduleEligibility(reservation, slot.changed, now);
  const calendar = previewCalendar(config, { date }, purchased);
  const choices =
    calendar.selectedDateKey === date
      ? calendar.selectedSlots.filter((s) => !s.booked)
      : [];
  const chosen = choices.find((s) => s.startISO === replacement);
  const change = () => {
    setDate(dateKeyInTimeZone(startsAt));
    setReplacement(null);
    setDialog("change");
  };
  return (
    <>
      <ReservationCardView
        reservation={reservation}
        now={now}
        participantsEnabled={config.participants.enabled}
        customerCancelled={slot.status === "cancelled"}
      >
        {slot.status === "confirmed" ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {eligibility.eligible
                ? `Změna zdarma do ${formatDateTime(eligibility.deadline)}. Termín můžete změnit jednou.`
                : rescheduleReasonMessage(eligibility.reason)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!eligibility.eligible}
                onClick={change}
              >
                {eligibility.eligible
                  ? "Změnit termín"
                  : "Změna termínu není dostupná"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Zrušit rezervaci ${slot.label}`}
                onClick={() => setDialog("cancel")}
              >
                Zrušit rezervaci
              </Button>
            </div>
          </div>
        ) : null}
      </ReservationCardView>
      {dialog === "cancel" ? (
        <Dialog
          title="Zrušit tuto rezervaci?"
          description={slot.label}
          onClose={() => setDialog(null)}
        >
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6">
            <p>Rezervace přestane platit. {amount.note}</p>
            {!eligibility.eligible && eligibility.reason === "inside_cutoff" ? (
              <p className="mt-3">
                Do začátku zbývá méně než 24 hodin. Změna termínu už není možná.
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Zrušíte pouze tento termín. Ostatní rezervace z objednávky zůstanou
            platné. V ukázkovém náhledu se storno pouze nasimuluje a žádný
            e-mail se neposílá.
          </p>
          {eligibility.eligible ? (
            <Button variant="outline" className="mt-4" onClick={change}>
              Raději změnit termín
            </Button>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              data-initial-focus
              variant="outline"
              onClick={() => setDialog(null)}
            >
              Ponechat rezervaci
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onCancel(slot.id);
                setDialog(null);
              }}
            >
              {amount.amount === 0
                ? "Ano, zrušit rezervaci"
                : "Ano, zrušit bez vrácení platby"}
            </Button>
          </div>
        </Dialog>
      ) : null}
      {dialog === "change" && eligibility.eligible ? (
        <Dialog
          title="Změnit termín"
          description={`Současný termín: ${slot.label}`}
          onClose={() => setDialog(null)}
        >
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Vyberte nový den a čas. Změní se pouze tato rezervace; její cena
            zůstane stejná. Původní termín platí až do potvrzení změny.
          </p>
          <label className="mt-4 grid gap-2 text-sm font-bold">
            Nové datum
            <Input
              data-initial-focus
              type="date"
              min={calendar.minDateKey}
              max={calendar.maxDateKey}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setReplacement(null);
              }}
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Volné časy">
            {choices.map((s) => (
              <Button
                key={s.startISO}
                variant="outline"
                size="sm"
                aria-pressed={s.startISO === replacement}
                onClick={() => setReplacement(s.startISO)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          {!choices.length ? (
            <p className="mt-4 text-sm">
              Pro tento den není volný termín. Vyberte jiné datum.
            </p>
          ) : null}
          {chosen ? (
            <p className="mt-5 rounded-md bg-accent p-3 text-sm text-accent-foreground">
              Nový termín:{" "}
              <strong>{formatDateTime(new Date(chosen.startISO))}</strong>
              <br />
              Cena zůstává {amount.price}.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Ponechat původní termín
            </Button>
            <Button
              disabled={!chosen}
              onClick={() => {
                if (chosen) {
                  onChange(slot.id, chosen.startISO);
                  setDialog(null);
                }
              }}
            >
              Potvrdit změnu termínu
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
