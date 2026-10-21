"use client";

import { useState, type ReactNode } from "react";
import "../content/content-canvas.css";
import { Pencil, X } from "lucide-react";
import { AdminDialog } from "@/components/admin/dialog";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DialogActions, DIALOG_BUTTON_CLASS } from "@/components/ui/dialog";
import { CancellationNotice } from "@/components/site/cancellation-notice";
import { cancellationPrice } from "@/lib/config/customer-cancellation";
import {
  NOTICE_DEFINITIONS,
  noticeDefinition,
  renderNotice,
  saveNoticeSchema,
  type NoticeId,
  type PublicNotices,
} from "@/lib/config/public-notices";
import { receiveAction } from "@/lib/helpers/action-response";
import { cn } from "@/lib/utils";
import { saveNoticeAction } from "./actions";

const sample = {
  time: "24. 10. 2026, 8:45 – 10:00",
  price: "199 Kč",
  refund_note: cancellationPrice({
    priceCents: 19900,
    currency: "czk",
    loyaltyReward: null,
    additionalPeoplePaidCents: 0,
  }).note,
};
const variableLabels: Record<string, string> = {
  time: "Datum a čas rezervace",
  price: "Cena rezervace",
  refund_note:
    "Skutečné podmínky vrácení platby včetně částky nebo bonusového vstupu",
};

/** Static renderings only. No live dialogs, consent managers, forms or providers mount in the canvas. */
export function NoticesEditor({ initial }: { initial: PublicNotices }) {
  const [active, setActive] = useState<NoticeId>("cancellation");
  const [notices, setNotices] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const def = noticeDefinition(active);
  const currentField = def.fields.find((f) => f.key === editing);
  const copy = notices[active];
  const visible =
    active === "cancellation"
      ? [
          "title",
          "body",
          "refund",
          "scope",
          "delivery",
          "alternative",
          "keep",
          "confirmPaid",
        ]
      : active === "reschedule"
        ? ["title", "original", "body", "date", "selection", "keep", "confirm"]
        : [
            "title",
            "body",
            "privacyLink",
            "analyticsTitle",
            "analyticsBody",
            "marketingTitle",
            "marketingBody",
            "reject",
            "save",
            "accept",
          ];
  const edit = (key: string): ReactNode => {
    const field = def.fields.find((f) => f.key === key)!;
    return (
      <span className="whitespace-pre-line break-words">
        {renderNotice(copy[key]!, sample)}
        <button
          type="button"
          aria-label={`Upravit: ${field.label}`}
          disabled={pending}
          className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card align-middle text-primary shadow-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => {
            setEditing(key);
            setDraft(copy[key]!);
            setError(null);
            setSaved(null);
          }}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
      </span>
    );
  };
  const action = (key: string, destructive = false) => (
    <div
      className={cn(
        buttonVariants({ variant: destructive ? "destructive" : "outline" }),
        DIALOG_BUTTON_CLASS,
      )}
    >
      {edit(key)}
    </div>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || pending) return;
    const input = { id: active, fields: { ...copy, [editing]: draft } };
    const parsed = saveNoticeSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setPending(true);
    setError(null);
    const response = await receiveAction(() => saveNoticeAction(parsed.data));
    setPending(false);
    if (!response.received) {
      setError(
        "Uložení se nepodařilo potvrdit. Před další úpravou obnovte stránku a ověřte uložený text.",
      );
      return;
    }
    if (!response.result.ok) {
      setError(response.result.error);
      return;
    }
    const fields = response.result.data;
    setNotices((previous) => ({
      ...previous,
      [input.id]: fields,
    }));
    setEditing(null);
    setSaved("Text je uložený a zveřejněný na webu.");
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav
        aria-label="Zákaznická upozornění"
        className="flex gap-2 overflow-x-auto pb-2 xl:grid"
      >
        {NOTICE_DEFINITIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-current={active === d.id ? "page" : undefined}
            disabled={pending}
            className={cn(
              "min-h-11 shrink-0 rounded-md border px-3 py-2 text-left text-sm font-semibold",
              active === d.id
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-transparent hover:bg-secondary",
            )}
            onClick={() => {
              setActive(d.id);
              setSaved(null);
            }}
          >
            {d.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        <p className="mb-4 text-sm text-muted-foreground">
          {def.description} Text upravíte tužkou přímo v náhledu.
        </p>
        <FormFeedback success={saved} />
        <section
          aria-label={`Náhled upozornění: ${def.label}`}
          className="content-canvas mt-4 min-w-0 rounded-lg border border-border bg-secondary/50 p-3 sm:p-6"
        >
          <div
            className={cn(
              "mx-auto rounded-lg border border-border p-4 shadow-sm sm:p-6",
              active === "cookies"
                ? "max-w-4xl bg-ink text-ink-foreground"
                : "max-w-3xl bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold">{edit("title")}</h2>
              {active !== "cookies" ? (
                <X aria-hidden="true" className="mt-2 size-4 shrink-0" />
              ) : null}
            </div>
            {active === "cancellation" ? (
              <>
                <p className="mt-3 font-bold">{sample.time}</p>
                <CancellationNotice
                  copy={copy}
                  variables={sample}
                  insideCutoff={false}
                  edit={edit}
                />
                <DialogActions columns={3}>
                  {action("alternative")}
                  {action("keep")}
                  {action("confirmPaid", true)}
                </DialogActions>
              </>
            ) : null}
            {active === "reschedule" ? (
              <>
                <p className="mt-3 font-bold">{edit("original")}</p>
                <p className="mt-4 text-sm leading-6">{edit("body")}</p>
                <div className="mt-4 text-sm font-bold">{edit("date")}</div>
                <div className="mt-2 rounded-md border bg-secondary/50 p-3 text-sm">
                  24. 10. 2026
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-primary bg-primary/10 p-3">
                    10:00 – 11:15
                  </div>
                  <div className="rounded-md border p-3">11:15 – 12:30</div>
                </div>
                <p className="mt-5 rounded-md bg-accent p-3 text-sm text-accent-foreground">
                  {edit("selection")}
                </p>
                <DialogActions>
                  {action("keep")}
                  {action("confirm")}
                </DialogActions>
              </>
            ) : null}
            {active === "cookies" ? (
              <>
                <p className="mt-3 text-sm leading-6">
                  {edit("body")}{" "}
                  <span className="text-gold underline">
                    {edit("privacyLink")}
                  </span>
                  .
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {["analytics", "marketing"].map((prefix) => (
                    <div
                      key={prefix}
                      className="flex gap-3 rounded-md border border-white/20 p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 size-5 shrink-0 rounded-sm border border-white/50"
                      />
                      <div>
                        <div className="font-extrabold">
                          {edit(`${prefix}Title`)}
                        </div>
                        <p className="mt-1 text-xs leading-5">
                          {edit(`${prefix}Body`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <DialogActions columns={3}>
                  {action("reject")}
                  {action("save")}
                  {action("accept")}
                </DialogActions>
              </>
            ) : null}
            <details className="mt-6 border-t border-border pt-4 text-sm">
              <summary className="cursor-pointer font-bold">
                Další stavy a popisky
              </summary>
              <div className="mt-3 grid gap-4">
                {def.fields
                  .filter((f) => !visible.includes(f.key))
                  .map((f) => (
                    <div key={f.key}>
                      <div className="mb-1 text-xs font-semibold">
                        {f.label}
                      </div>
                      {edit(f.key)}
                    </div>
                  ))}
              </div>
            </details>
          </div>
        </section>
        {def.variables.length ? (
          <div className="mt-4 rounded-lg border bg-card p-4 text-sm">
            <p className="font-semibold">Co doplňuje systém</p>
            <dl className="mt-2 grid gap-2">
              {def.variables.map((v) => (
                <div key={v}>
                  <dt className="inline font-mono text-xs">{`{${v}}`}</dt>
                  {" — "}
                  <dd className="inline text-muted-foreground">
                    {variableLabels[v]}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Částky, termíny a pravidla rezervací zůstávají řízené systémem.
              Náhled používá ukázkové hodnoty.
            </p>
          </div>
        ) : null}
      </div>
      {currentField ? (
        <AdminDialog
          title={`Upravit: ${currentField.label}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <label htmlFor="notice-text" className="text-sm font-semibold">
              Text
            </label>
            <Textarea
              id="notice-text"
              data-initial-focus
              value={draft}
              disabled={pending}
              rows={currentField.button ? 2 : 5}
              maxLength={currentField.button ? 100 : 3000}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-2"
              aria-describedby="notice-help"
            />
            <p id="notice-help" className="mt-2 text-sm text-muted-foreground">
              {currentField.required?.length
                ? `Zachovejte ${currentField.required.map((v) => `{${v}}`).join(", ")}. Hodnoty doplní systém.`
                : "Ukládá se pouze tento text vybraného upozornění."}
            </p>
            <div className="mt-3">
              <FormFeedback error={error} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <SubmitButton isSubmitting={pending}>Uložit text</SubmitButton>
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => setEditing(null)}
              >
                Zrušit úpravu
              </Button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
}
