"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { Button } from "@/components/ui/button";
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
    <form onSubmit={submit} className="flex items-center gap-2">
      <input type="hidden" {...form.register("id")} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={form.formState.isSubmitting}
      >
        Zrušit
      </Button>
      {serverError && (
        <span role="alert" className="text-xs text-destructive">
          {serverError}
        </span>
      )}
    </form>
  );
}
