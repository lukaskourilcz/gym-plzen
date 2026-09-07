"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
      <div className="[&>div]:mb-0">
        <Field
          name="open"
          controlId={`open-${dayOfWeek}`}
          label="Otevřeno"
          error={formState.errors.open}
        >
          <Input
            id={`open-${dayOfWeek}`}
            type="time"
            className="w-32"
            {...register("open")}
          />
        </Field>
      </div>
      <div className="[&>div]:mb-0">
        <Field
          name="close"
          controlId={`close-${dayOfWeek}`}
          label="Zavřeno"
          error={formState.errors.close}
        >
          <Input
            id={`close-${dayOfWeek}`}
            type="time"
            className="w-32"
            {...register("close")}
          />
        </Field>
      </div>
      <div className="[&>div]:mb-0">
        <Field
          name="slotMinutes"
          controlId={`slot-${dayOfWeek}`}
          label="Slot (min)"
          error={formState.errors.slotMinutes}
        >
          <Input
            id={`slot-${dayOfWeek}`}
            type="number"
            min={15}
            step={15}
            className="w-24"
            {...register("slotMinutes", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 pb-2 text-sm">
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
          <option value="holiday">Dovolená</option>
          <option value="private_event">Soukromá akce</option>
          <option value="other">Ostatní</option>
        </Select>
      </Field>
      <Field name="note" label="Poznámka" error={errors.note}>
        <Input id="note" {...register("note")} />
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
  const { form, submit, serverError } = useActionForm({
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
      <FormFeedback error={serverError} />
    </form>
  );
}
