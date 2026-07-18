"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { minutesToHHmm } from "@/lib/helpers/format";
import {
  createBlockedSlotSchema,
  deleteBlockedSlotSchema,
  openingHoursSchema,
  showerMinutesSchema,
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
      open: hours ? minutesToHHmm(hours.openMinute) : "05:00",
      close: hours ? minutesToHHmm(hours.closeMinute) : "21:00",
      slotMinutes: hours?.slotMinutes ?? 60,
      isClosed: hours?.isClosed === 1,
    },
  });
  const { register, formState } = form;

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", alignItems: "end", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}
    >
      <input type="hidden" {...register("dayOfWeek", { valueAsNumber: true })} />
      <div style={{ width: 90 }}>
        <strong>{DAY_NAMES[dayOfWeek]}</strong>
      </div>
      <div>
        <label htmlFor={`open-${dayOfWeek}`}>Otevřeno</label>
        <input id={`open-${dayOfWeek}`} type="time" {...register("open")} />
      </div>
      <div>
        <label htmlFor={`close-${dayOfWeek}`}>Zavřeno</label>
        <input id={`close-${dayOfWeek}`} type="time" {...register("close")} />
      </div>
      <div>
        <label htmlFor={`slot-${dayOfWeek}`}>Slot (min)</label>
        <input
          id={`slot-${dayOfWeek}`}
          type="number"
          min={15}
          step={15}
          style={{ width: 90 }}
          {...register("slotMinutes", { valueAsNumber: true })}
        />
      </div>
      <label style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        <input type="checkbox" style={{ width: "auto" }} {...register("isClosed")} />
        Zavřeno
      </label>
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit</SubmitButton>
      <FormFeedback error={serverError} success={success} />
    </form>
  );
}

/** Form to add a blocked time range. */
export function BlockedSlotForm() {
  const { form, submit, serverError, success } = useActionForm({
    schema: createBlockedSlotSchema,
    action: createBlockedSlotAction,
    successMessage: "Blok vytvořen.",
    resetOnSuccess: true,
    defaultValues: { reason: "other" },
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  return (
    <form onSubmit={submit} style={{ maxWidth: 420 }}>
      <Field name="startsAt" label="Začátek" error={errors.startsAt}>
        <input id="startsAt" type="datetime-local" {...register("startsAt")} />
      </Field>
      <Field name="endsAt" label="Konec" error={errors.endsAt}>
        <input id="endsAt" type="datetime-local" {...register("endsAt")} />
      </Field>
      <Field name="reason" label="Důvod" error={errors.reason}>
        <select id="reason" {...register("reason")}>
          <option value="maintenance">Údržba</option>
          <option value="holiday">Svátek</option>
          <option value="private_event">Soukromá akce</option>
          <option value="other">Jiné</option>
        </select>
      </Field>
      <Field name="note" label="Poznámka" error={errors.note}>
        <input id="note" {...register("note")} />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={isSubmitting}>Přidat blok</SubmitButton>
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
    <form onSubmit={submit} style={{ maxWidth: 320 }}>
      <Field
        name="showerMinutes"
        label="Doba na sprchu po tréninku (min)"
        error={form.formState.errors.showerMinutes}
      >
        <input
          id="showerMinutes"
          type="number"
          min={0}
          max={120}
          {...form.register("showerMinutes", { valueAsNumber: true })}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>Uložit</SubmitButton>
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
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        style={{ background: "var(--danger)" }}
      >
        Odstranit
      </button>
    </form>
  );
}
