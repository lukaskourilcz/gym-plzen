"use client";

import { useState } from "react";
import { ReservationCardView } from "@/components/site/reservation-card-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DIALOG_BUTTON_CLASS,
} from "@/components/ui/dialog";
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

import { usePublicNotices } from "@/components/site/public-notices-provider";
import { CancellationNotice } from "@/components/site/cancellation-notice";
import { renderNotice } from "@/lib/config/public-notices";

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
  const notices = usePublicNotices();
  const variables = {
    time: slot.label,
    price: amount.price,
    refund_note: amount.note,
  };
  const text = (key: string) =>
    renderNotice(notices.cancellation[key] ?? "", variables);
  const changeText = (key: string, time = slot.label) =>
    renderNotice(notices.reschedule[key] ?? "", { time, price: amount.price });
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
          title={text("title")}
          className="max-w-3xl"
          description={slot.label}
          onClose={() => setDialog(null)}
        >
          <CancellationNotice
            copy={notices.cancellation}
            variables={variables}
            insideCutoff={
              !eligibility.eligible && eligibility.reason === "inside_cutoff"
            }
            preview
          />
          <DialogActions columns={eligibility.eligible ? 3 : 2}>
            {eligibility.eligible ? (
              <Button
                variant="outline"
                className={DIALOG_BUTTON_CLASS}
                onClick={change}
              >
                {text("alternative")}
              </Button>
            ) : null}
            <Button
              data-initial-focus
              className={DIALOG_BUTTON_CLASS}
              variant="outline"
              onClick={() => setDialog(null)}
            >
              {text("keep")}
            </Button>
            <Button
              variant="destructive"
              className={DIALOG_BUTTON_CLASS}
              onClick={() => {
                onCancel(slot.id);
                setDialog(null);
              }}
            >
              {amount.amount === 0 ? text("confirmFree") : text("confirmPaid")}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
      {dialog === "change" && eligibility.eligible ? (
        <Dialog
          title={changeText("title")}
          description={changeText("original")}
          onClose={() => setDialog(null)}
        >
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {changeText("body")}
          </p>
          <label className="mt-4 grid gap-2 text-sm font-bold">
            {changeText("date")}
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
                className={
                  s.startISO === replacement
                    ? "border-primary bg-primary/10 text-primary"
                    : undefined
                }
                onClick={() => setReplacement(s.startISO)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          {!choices.length ? (
            <p className="mt-4 text-sm">{changeText("empty")}</p>
          ) : null}
          {chosen ? (
            <p className="mt-5 whitespace-pre-line rounded-md bg-accent p-3 text-sm text-accent-foreground">
              {changeText(
                "selection",
                formatDateTime(new Date(chosen.startISO)),
              )}
            </p>
          ) : null}
          <DialogActions>
            <Button
              className={DIALOG_BUTTON_CLASS}
              variant="outline"
              onClick={() => setDialog(null)}
            >
              {changeText("keep")}
            </Button>
            <Button
              className={DIALOG_BUTTON_CLASS}
              disabled={!chosen}
              onClick={() => {
                if (chosen) {
                  onChange(slot.id, chosen.startISO);
                  setDialog(null);
                }
              }}
            >
              {changeText("confirm")}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
