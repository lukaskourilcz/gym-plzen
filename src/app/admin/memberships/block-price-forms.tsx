"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Notice } from "@/components/ui/notice";
import {
  type BlockPrice,
  type PricingHours,
  isBlockPriceAligned,
  pricingSlots,
} from "@/lib/config/block-pricing";
import { type ParticipantPricing } from "@/lib/config/participants";
import {
  saveBlockPriceSchema,
  saveParticipantPricingSchema,
} from "@/lib/validations/pricing";
import { formatMoney, minutesToHHmm } from "@/lib/helpers/format";
import {
  saveBlockPriceAction,
  deleteBlockPriceAction,
  saveParticipantPricingAction,
} from "./actions";

const DAYS = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export function BlockPrices({
  hours,
  rules,
}: {
  hours: PricingHours[];
  rules: BlockPrice[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ rule?: BlockPrice } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  async function remove(id: string) {
    setError(null);
    setDeleting(id);
    try {
      const result = await deleteBlockPriceAction({ id });
      if (!result.ok) setError(result.error);
      else {
        if (editor?.rule?.id === id) setEditor(null);
        router.refresh();
      }
    } catch {
      setError("Spojení se přerušilo. Zkuste to znovu.");
    } finally {
      setDeleting(null);
    }
  }
  function openEditor(button: HTMLButtonElement, rule?: BlockPrice) {
    trigger.current = button;
    setSaved(false);
    setEditor({ rule });
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <section
      aria-labelledby="block-prices-heading"
      className="mb-8 rounded-lg border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="block-prices-heading" className="text-xl font-bold">
        Ceny podle času
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Každý den může mít několik cenových bloků. Vyberte den a rozsah
        tréninků. Cena platí za jeden blok pro jednu dospělou osobu. Ostatní
        bloky používají cenu podle data, případně standardní cenu. Uložené
        rezervace se nepřecení.
      </p>
      <div className="mt-6 divide-y divide-border">
        {DAY_ORDER.map((day) => {
          const configured = hours.find((h) => h.dayOfWeek === day);
          const own = rules.filter((r) => r.dayOfWeek === day);
          return (
            <div key={day} className="grid gap-3 py-3 sm:grid-cols-[7rem_1fr]">
              <h3 className="pt-2 font-semibold">{DAYS[day]}</h3>
              <div className="grid gap-2">
                {own.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {!configured || configured.isClosed
                      ? "Zavřeno"
                      : "Cena podle data / standardní cena"}
                  </p>
                ) : (
                  own.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <div className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-auto">
                        <strong>
                          {minutesToHHmm(rule.startMinute)} až{" "}
                          {minutesToHHmm(rule.endMinute)}
                        </strong>{" "}
                        · {formatMoney(rule.priceCents)} za blok
                        {!configured ||
                        !isBlockPriceAligned(rule, configured) ? (
                          <span className="block text-destructive">
                            Rozvrh se změnil. Upravte rozsah, aby cena znovu
                            platila.
                          </span>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-haspopup="dialog"
                        onClick={(event) =>
                          openEditor(event.currentTarget, rule)
                        }
                      >
                        Upravit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleting !== null}
                        onClick={() => void remove(rule.id)}
                      >
                        {deleting === rule.id ? "Odebírám…" : "Odebrat"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <FormFeedback
        error={error}
        success={saved ? "Cena bloků uložena." : null}
      />
      <div className="mt-5 border-t border-border pt-5">
        <Button
          aria-haspopup="dialog"
          onClick={(event) => openEditor(event.currentTarget)}
        >
          Přidat cenový blok
        </Button>
      </div>
      {editor ? (
        <BlockPriceDialog
          rule={editor.rule}
          hours={hours}
          onClose={closeEditor}
          onSaved={() => {
            setSaved(true);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
function BlockPriceDialog({
  rule,
  hours,
  onClose,
  onSaved,
}: {
  rule?: BlockPrice;
  hours: PricingHours[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      if (element?.open) element.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-md backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-xl font-bold">
          {rule ? "Upravit cenový blok" : "Přidat cenový blok"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Zavřít dialog"
          onClick={() => dialog.current?.close()}
        >
          <X className="size-5" aria-hidden="true" />
        </Button>
      </div>
      <p id={descriptionId} className="mb-5 text-sm text-muted-foreground">
        Cena za jeden blok pro jednu dospělou osobu. Časy odpovídají uloženému
        rozvrhu.
      </p>
      <BlockPriceForm
        rule={rule}
        hours={hours}
        onSaved={() => {
          onSaved();
          dialog.current?.close();
        }}
        onCancel={() => dialog.current?.close()}
      />
    </dialog>
  );
}
function BlockPriceForm({
  rule,
  hours,
  onSaved,
  onCancel,
}: {
  rule?: BlockPrice;
  hours: PricingHours[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const firstDay =
    DAY_ORDER.find((day) =>
      hours.some((h) => h.dayOfWeek === day && pricingSlots(h).length),
    ) ?? 1;
  const { form, submit, serverError, success } = useActionForm({
    schema: saveBlockPriceSchema,
    action: saveBlockPriceAction,
    onSuccess: onSaved,
    successMessage: "Cena bloků uložena.",
    resetOnSuccess: !rule,
    defaultValues: {
      id: rule?.id,
      applyToMatchingDays: false,
      dayOfWeek: rule?.dayOfWeek ?? firstDay,
      startMinute: rule?.startMinute,
      endMinute: rule?.endMinute,
      priceCzk: rule ? rule.priceCents / 100 : undefined,
    },
  });
  const day = form.watch("dayOfWeek");
  const start = form.watch("startMinute");
  const configured = hours.find((h) => h.dayOfWeek === day);
  const blocks = configured ? pricingSlots(configured) : [];
  return (
    <form onSubmit={submit} noValidate>
      {blocks.length === 0 ? (
        <Notice>
          Nejdříve nastavte otevírací dobu a délku bloků v sekci Otevírací doba.
        </Notice>
      ) : null}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field
          name="block-day"
          label="Den"
          error={form.formState.errors.dayOfWeek}
        >
          <Select
            data-initial-focus="true"
            className="min-h-11"
            id="block-day"
            {...form.register("dayOfWeek", { valueAsNumber: true })}
            onChange={(e) => {
              form.setValue("dayOfWeek", Number(e.target.value));
              form.setValue("startMinute", NaN);
              form.setValue("endMinute", NaN);
            }}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          name="block-first"
          label="Čas od"
          error={form.formState.errors.startMinute}
        >
          <Select
            className="min-h-11"
            id="block-first"
            {...form.register("startMinute", { valueAsNumber: true })}
          >
            <option value="">Vyberte začátek</option>
            {blocks.map((b) => (
              <option key={b.startMinute} value={b.startMinute}>
                {minutesToHHmm(b.startMinute)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          name="block-last"
          label="Čas do"
          error={form.formState.errors.endMinute}
        >
          <Select
            className="min-h-11"
            id="block-last"
            {...form.register("endMinute", { valueAsNumber: true })}
          >
            <option value="">Vyberte konec</option>
            {blocks
              .filter((b) => !Number.isFinite(start) || b.startMinute >= start)
              .map((b) => (
                <option key={b.endMinute} value={b.endMinute}>
                  {minutesToHHmm(b.endMinute)}
                </option>
              ))}
          </Select>
        </Field>
        <Field
          name="block-price"
          label="Cena za blok (Kč)"
          error={form.formState.errors.priceCzk}
        >
          <Input
            id="block-price"
            type="number"
            min={1}
            max={10000}
            step={1}
            {...form.register("priceCzk", { valueAsNumber: true })}
          />
        </Field>
      </div>
      {!rule ? (
        <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--color-primary)]"
            {...form.register("applyToMatchingDays")}
          />
          Stejnou cenu uložit i pro ostatní otevřené dny se stejnými bloky.
        </label>
      ) : null}
      <FormFeedback error={serverError} success={success} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          isSubmitting={form.formState.isSubmitting}
          disabled={!blocks.length}
        >
          Uložit cenu bloků
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {rule ? "Zrušit úpravu" : "Zrušit"}
        </Button>
      </div>
    </form>
  );
}
export function ParticipantPricingForm({
  pricing,
}: {
  pricing: ParticipantPricing;
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: saveParticipantPricingSchema,
    action: saveParticipantPricingAction,
    successMessage: "Příplatek za doprovod uložen.",
    defaultValues: { priceCzk: pricing.amountCents / 100, mode: pricing.mode },
  });
  const mode = form.watch("mode");
  const price = form.watch("priceCzk");
  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field
          name="participant-price"
          label="Příplatek (Kč)"
          error={form.formState.errors.priceCzk}
        >
          <Input
            id="participant-price"
            type="number"
            min={0}
            max={10000}
            step={1}
            {...form.register("priceCzk", { valueAsNumber: true })}
          />
        </Field>
        <Field
          name="participant-mode"
          label="Jak se příplatek počítá"
          error={form.formState.errors.mode}
        >
          <Select
            className="min-h-11"
            id="participant-mode"
            {...form.register("mode")}
          >
            <option value="flat">Jednou za 1–2 další osoby</option>
            <option value="per_person">Za každou další osobu zvlášť</option>
          </Select>
        </Field>
      </div>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {Number.isFinite(price)
          ? `1 osoba navíc: ${formatMoney(price * 100)}. 2 osoby navíc: ${formatMoney(price * 100 * (mode === "per_person" ? 2 : 1))}. Příplatek platí za každý rezervovaný blok i u věrnostního vstupu.`
          : "Zadejte příplatek."}
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit příplatek
      </SubmitButton>
    </form>
  );
}
