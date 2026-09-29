"use client";

import { useId, useRef, useState } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import { FormFeedback } from "@/components/admin/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelReservationSchema } from "@/lib/validations/reservations";
import { cancelReservationAction } from "./actions";

/**
 * Two-step cancel control for a reservation row (the same inline pattern as
 * removing a pricing period). Cancelling e-mails the customer, so the first
 * click only opens the confirmation with an optional reason that the e-mail
 * carries; focus moves into it and returns to the trigger when kept.
 */
export function CancelButton({ reservationId }: { reservationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const reasonId = useId();
  const { form, submit, serverError } = useActionForm({
    schema: cancelReservationSchema,
    action: cancelReservationAction,
    defaultValues: { id: reservationId, reason: "" },
    onSuccess: () => setConfirming(false),
  });
  const isSubmitting = form.formState.isSubmitting;

  function keep() {
    setConfirming(false);
    form.reset({ id: reservationId, reason: "" });
    // The trigger renders again on the next frame; hand focus back to it.
    requestAnimationFrame(() =>
      trigger.current?.querySelector("button")?.focus(),
    );
  }

  if (!confirming) {
    return (
      <div ref={trigger}>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Zrušit
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          keep();
        }
      }}
      className="flex min-w-60 flex-col gap-2"
    >
      <input type="hidden" {...form.register("id")} />
      <div>
        <Label htmlFor={reasonId}>Důvod pro zákazníka (nepovinné)</Label>
        <Input
          id={reasonId}
          // Focus moves into the confirmation the click opened.
          autoFocus
          maxLength={300}
          {...form.register("reason")}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Zákazníkovi odejde e-mail o zrušení.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Ruším…" : "Ano, zrušit rezervaci"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={keep}
        >
          Ponechat
        </Button>
      </div>
      <FormFeedback error={serverError} />
    </form>
  );
}
