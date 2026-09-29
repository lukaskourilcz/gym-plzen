"use client";

import { useEffect, useRef, useState } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import { Notice } from "@/components/ui/notice";
import {
  closureFailureMessage,
  reservationsAccusative,
} from "@/lib/helpers/closure-copy";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { minutesToHHmm } from "@/lib/helpers/format";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";
import {
  createBlockedSlotSchema,
  deleteBlockedSlotSchema,
  openingHoursSchema,
  showerMinutesSchema,
  type CreateBlockedSlotValues,
} from "@/lib/validations/schedule";
import type { OpeningHours } from "@/lib/db/types";
import {
  createBlockedSlotAction,
  deleteBlockedSlotAction,
  saveOpeningHoursAction,
  saveShowerMinutesAction,
} from "./actions";

const DAY_NAMES = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
];

/** One row of the opening-hours editor for a given weekday. */
export function OpeningHoursRow({
  dayOfWeek,
  hours,
}: {
  dayOfWeek: number;
  hours?: OpeningHours;
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: openingHoursSchema,
    action: saveOpeningHoursAction,
    successMessage: "Uloženo.",
    defaultValues: {
      dayOfWeek,
      open: minutesToHHmm(hours?.openMinute ?? DEFAULT_OPEN_MINUTE),
      close: minutesToHHmm(hours?.closeMinute ?? DEFAULT_CLOSE_MINUTE),
      slotMinutes: hours?.slotMinutes ?? DEFAULT_SLOT_MINUTES,
      isClosed: hours?.isClosed === 1,
    },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit} className="mb-2 flex flex-wrap items-end gap-3">
      <input
        type="hidden"
        {...register("dayOfWeek", { valueAsNumber: true })}
      />
      <div className="w-20 pb-2 font-medium">{DAY_NAMES[dayOfWeek]}</div>
      <div>
        <Label htmlFor={`open-${dayOfWeek}`}>Otevřeno</Label>
        <Input
          id={`open-${dayOfWeek}`}
          type="time"
          className="w-32"
          {...register("open")}
        />
      </div>
      <div>
        <Label htmlFor={`close-${dayOfWeek}`}>Zavřeno</Label>
        <Input
          id={`close-${dayOfWeek}`}
          type="time"
          className="w-32"
          {...register("close")}
        />
      </div>
      <div>
        <Label htmlFor={`slot-${dayOfWeek}`}>Slot (min)</Label>
        <Input
          id={`slot-${dayOfWeek}`}
          type="number"
          min={15}
          step={15}
          className="w-24"
          {...register("slotMinutes", { valueAsNumber: true })}
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-primary)]"
          {...register("isClosed")}
        />
        Zavřeno
      </label>
      <div className="pb-0.5">
        <SubmitButton isSubmitting={formState.isSubmitting}>
          Uložit
        </SubmitButton>
      </div>
      <FormFeedback error={serverError} success={success} />
    </form>
  );
}

/**
 * Form to add a blocked time range. Over existing bookings the server first
 * answers with their count; the form then asks the admin to confirm exactly
 * that many cancellations before sending the block again.
 */
export function BlockedSlotForm() {
  // A ref, not state: the confirm button sets it and submits in one handler.
  const confirmedCount = useRef<number | undefined>(undefined);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    count: number;
    message: string;
  } | null>(null);
  // The confirmation request travels as a refused result so the form stays
  // filled in; it is shown in the notice below, never as an error.
  const confirmationMessage = useRef<string | null>(null);
  const { form, submit, serverError, success } = useActionForm({
    schema: createBlockedSlotSchema,
    action: async (values: CreateBlockedSlotValues) => {
      const result = await createBlockedSlotAction({
        ...values,
        confirmCancellations: confirmedCount.current,
      });
      confirmedCount.current = undefined;
      if (!result.ok) return result;
      const outcome = result.data;
      if (outcome.status === "needs_confirmation") {
        confirmationMessage.current = outcome.message;
        setPendingConfirmation({
          count: outcome.affectedCount,
          message: outcome.message,
        });
        return { ok: false as const, error: outcome.message };
      }
      setPendingConfirmation(null);
      if (outcome.failed.length > 0)
        return {
          ok: false as const,
          error: closureFailureMessage(outcome.failed),
        };
      return result;
    },
    successMessage: "Blok vytvořen.",
    resetOnSuccess: true,
    defaultValues: { reason: "other" },
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  // Editing the range after the warning voids it: the count was for the old one.
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name === "startsAt" || name === "endsAt")
        setPendingConfirmation(null);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  function confirmAndSubmit() {
    if (!pendingConfirmation) return;
    confirmedCount.current = pendingConfirmation.count;
    void submit();
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <Field name="startsAt" label="Začátek" error={errors.startsAt}>
        <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
      </Field>
      <Field name="endsAt" label="Konec" error={errors.endsAt}>
        <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
      </Field>
      <Field name="reason" label="Důvod" error={errors.reason}>
        <Select id="reason" {...register("reason")}>
          <option value="maintenance">Údržba</option>
          <option value="holiday">Svátek</option>
          <option value="private_event">Soukromá akce</option>
          <option value="other">Jiné</option>
        </Select>
      </Field>
      <Field name="note" label="Poznámka" error={errors.note}>
        <Input id="note" {...register("note")} />
      </Field>
      {pendingConfirmation ? (
        <Notice tone="warning" role="alert" className="mb-4">
          <p>{pendingConfirmation.message}</p>
          <p className="mt-1">
            Poznámka se zákazníkům pošle jako důvod zrušení.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              // Focus moves to the decision the warning asks for.
              autoFocus
              type="button"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              onClick={confirmAndSubmit}
            >
              {isSubmitting
                ? "Ukládám…"
                : `Uzavřít a zrušit ${reservationsAccusative(pendingConfirmation.count)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                setPendingConfirmation(null);
                form.setFocus("startsAt");
              }}
            >
              Ponechat rezervace
            </Button>
          </div>
        </Notice>
      ) : (
        <FormFeedback
          error={
            serverError === confirmationMessage.current ? null : serverError
          }
          success={success}
        />
      )}
      <SubmitButton
        isSubmitting={isSubmitting}
        disabled={!!pendingConfirmation}
      >
        Přidat blok
      </SubmitButton>
    </form>
  );
}

/** Shower-grace setting (minutes the code stays valid after a slot). */
export function ShowerMinutesForm({ current }: { current: number }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: showerMinutesSchema,
    action: saveShowerMinutesAction,
    successMessage: "Uloženo.",
    defaultValues: { showerMinutes: current },
  });
  return (
    <form onSubmit={submit} className="max-w-xs">
      <Field
        name="showerMinutes"
        label="Doba na sprchu po tréninku (min)"
        error={form.formState.errors.showerMinutes}
      >
        <Input
          id="showerMinutes"
          type="number"
          min={0}
          max={120}
          {...form.register("showerMinutes", { valueAsNumber: true })}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit
      </SubmitButton>
    </form>
  );
}

/** Delete control for a blocked slot. */
export function DeleteBlockButton({ id }: { id: string }) {
  const { form, submit } = useActionForm({
    schema: deleteBlockedSlotSchema,
    action: deleteBlockedSlotAction,
    defaultValues: { id },
  });
  return (
    <form onSubmit={submit}>
      <input type="hidden" {...form.register("id")} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={form.formState.isSubmitting}
      >
        Odstranit
      </Button>
    </form>
  );
}
