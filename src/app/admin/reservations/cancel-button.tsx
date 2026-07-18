"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { cancelReservationSchema } from "@/lib/validations/reservations";
import { cancelReservationAction } from "./actions";

/** Inline cancel control for a reservation row. */
export function CancelButton({ reservationId }: { reservationId: string }) {
  const { form, submit, serverError } = useActionForm({
    schema: cancelReservationSchema,
    action: cancelReservationAction,
    defaultValues: { id: reservationId },
  });

  return (
    <form onSubmit={submit}>
      <input type="hidden" {...form.register("id")} />
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        style={{ background: "var(--danger)" }}
      >
        Zrušit
      </button>
      {serverError && <span className="field-error"> {serverError}</span>}
    </form>
  );
}
