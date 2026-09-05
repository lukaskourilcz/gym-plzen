"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/admin/form-controls";
import { useActionForm } from "@/components/admin/use-action-form";
import { deletePricingPeriodSchema } from "@/lib/validations/memberships";
import { deletePricingPeriodAction } from "./actions";

/** Inline two-step removal avoids accidental deletion without a native dialog. */
export function PricingPeriodDeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const { form, submit, serverError } = useActionForm({
    schema: deletePricingPeriodSchema,
    action: deletePricingPeriodAction,
    defaultValues: { id },
    onSuccess: () => setConfirming(false),
  });

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Odstranit
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" {...form.register("id")} />
      <span className="text-xs font-medium text-muted-foreground">
        Opravdu odstranit?
      </span>
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Odstraňuji…" : "Ano, odstranit"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        Ponechat
      </Button>
      <FormFeedback error={serverError} />
    </form>
  );
}
