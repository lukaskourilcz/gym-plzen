"use client";
import { useRouter } from "next/navigation";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Select } from "@/components/ui/select";
import {
  type ParticipantPricing,
  participantAdditionPrice,
} from "@/lib/config/participants";
import { addParticipantsSchema } from "@/lib/validations/participants";
import { addParticipantsAction } from "./actions";
import { formatMoney } from "@/lib/helpers/format";

export function ParticipantsForm({
  reservationId,
  fromCount,
  pricing,
  fixedTarget,
}: {
  reservationId: string;
  fromCount: number;
  pricing: ParticipantPricing;
  fixedTarget?: number;
}) {
  const router = useRouter();
  const { form, submit, serverError, success } = useActionForm({
    schema: addParticipantsSchema,
    action: async (input) => {
      const result = await addParticipantsAction({
        ...input,
        quotedCents: participantAdditionPrice(
          fromCount,
          input.toCount,
          pricing,
          fixedTarget,
        ),
      });
      if (result.ok) {
        if (result.data.kind === "checkout")
          window.location.assign(result.data.url);
        else
          router.push(
            `/account/rezervace/${reservationId}/osoby?addition_id=${result.data.additionId}`,
          );
      }
      return result;
    },
    defaultValues: {
      reservationId,
      toCount: fixedTarget ?? fromCount + 1,
      quotedCents: participantAdditionPrice(
        fromCount,
        fixedTarget ?? fromCount + 1,
        pricing,
      ),
    },
    successMessage: "Požadavek na doprovod uložen.",
  });
  const toCount = form.watch("toCount");
  const price = participantAdditionPrice(fromCount, toCount, pricing);
  return (
    <form onSubmit={submit} noValidate>
      <Field
        name="toCount"
        label="Celkový doprovod v rezervaci"
        error={form.formState.errors.toCount}
      >
        <Select
          id="toCount"
          className="min-h-11"
          {...form.register("toCount", { valueAsNumber: true })}
        >
          {[1, 2]
            .filter(
              (count) =>
                count > fromCount &&
                (fixedTarget === undefined || count === fixedTarget),
            )
            .map((count) => (
              <option key={count} value={count}>
                Já + {count} {count === 1 ? "osoba" : "osoby"}
              </option>
            ))}
        </Select>
      </Field>
      <p role="status" className="mb-4 text-lg font-bold">
        Doplatek: {formatMoney(price)}
      </p>
      <p className="mb-5 text-sm text-muted-foreground">
        {price === 0
          ? "Další osoba je zahrnutá v jednotném příplatku za doprovod. Přidá se po vašem potvrzení."
          : "Doprovod se přidá až po ověřené úhradě. Původní rezervace a vstupní kód zůstávají platné."}
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        {fixedTarget !== undefined
          ? "Pokračovat v původní platbě"
          : price === 0
            ? "Potvrdit přidání osoby"
            : `Zaplatit doplatek ${formatMoney(price)}`}
      </SubmitButton>
    </form>
  );
}
