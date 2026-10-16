"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ban, Pencil, Check } from "lucide-react";
import { AdminDialog } from "@/components/admin/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import {
  blockSlotKey,
  minuteLabel,
  slotFitsHours,
  type BlockingHours,
  type BlockingSlot,
  type BlockPreviewInput,
  type BlockTarget,
} from "@/lib/config/blocking";
import { formatDateTime } from "@/lib/helpers/format";
import type { BlockPreview } from "@/lib/services/blocking";
import {
  saveBlockTemplateAction,
  previewBlockApplicationAction,
  applyBlockTemplatesAction,
  cancelBlockApplicationAction,
} from "./actions";

const WEEKDAYS = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
type Template = {
  id: string;
  name: string;
  slots: BlockingSlot[];
  updatedAt: string;
};
type Application = {
  id: string;
  snapshot: BlockPreview["snapshot"];
  createdAt: string;
  cancelledAt: string | null;
};

export function BlockingManager({
  templates,
  applications,
  hours,
  today,
}: {
  templates: Template[];
  applications: Application[];
  hours: BlockingHours[];
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [using, setUsing] = useState<string[] | null>(null);
  const [cancel, setCancel] = useState<Application | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function saved(text: string) {
    setMessage(text);
    router.refresh();
  }
  return (
    <div className="space-y-7">
      {message && (
        <p
          role="status"
          className="rounded-md bg-accent p-3 text-sm text-accent-foreground"
        >
          {message}
        </p>
      )}
      <section aria-labelledby="blocking-templates">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="blocking-templates"
            className="text-xl font-bold tracking-tight"
          >
            Šablony blokací
          </h2>
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Přidat šablonu
          </Button>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-2 text-sm">
                  {WEEK.filter((day) =>
                    template.slots.some((slot) => slot.dayOfWeek === day),
                  ).map((day) => (
                    <li key={day}>
                      <span className="font-semibold">{WEEKDAYS[day]}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {template.slots
                          .filter((slot) => slot.dayOfWeek === day)
                          .map(
                            (slot) =>
                              `${minuteLabel(slot.startMinute)}–${minuteLabel(slot.endMinute)}`,
                          )
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
                {!template.slots.every((slot) =>
                  slotFitsHours(slot, hours),
                ) && (
                  <p className="text-sm text-warning-foreground">
                    Šablonu nejprve upravte podle aktuálního rozvrhu.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setUsing([template.id])}>
                    Použít
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(template)}
                  >
                    <Pencil className="mr-2 size-4" aria-hidden="true" />
                    Upravit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {templates.length > 1 && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setUsing([])}
          >
            Použít více šablon
          </Button>
        )}
      </section>
      <section aria-labelledby="blocking-history">
        <h2
          id="blocking-history"
          className="mb-4 text-xl font-bold tracking-tight"
        >
          Použité blokace
        </h2>
        {applications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Zatím jste žádnou šablonu nepoužili. Samotná šablona termíny
              neblokuje.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {applications.map((application) => (
              <Card key={application.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div>
                    <p className="font-semibold">
                      {application.snapshot.templates
                        .map((template) => template.name)
                        .join(" + ")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.snapshot.windows.length} slotů ·{" "}
                      {application.snapshot.windows[0]?.dateKey} až{" "}
                      {application.snapshot.windows.at(-1)?.dateKey} · vytvořeno{" "}
                      {formatDateTime(new Date(application.createdAt))}
                    </p>
                    {application.cancelledAt && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Budoucí blokace zrušeny{" "}
                        {formatDateTime(new Date(application.cancelledAt))}
                      </p>
                    )}
                  </div>
                  {!application.cancelledAt && (
                    <Button
                      variant="outline"
                      onClick={() => setCancel(application)}
                    >
                      Zrušit budoucí blokace
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      {editing && (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          hours={hours}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            saved("Šablona uložena. Již použité blokace se nemění.");
          }}
        />
      )}
      {using && (
        <ApplyDialog
          selectedIds={using}
          templates={templates}
          today={today}
          onClose={() => setUsing(null)}
          onSaved={(count) => {
            setUsing(null);
            saved(
              `Uloženo ${count} blokací. Existující rezervace zůstávají platné.`,
            );
          }}
        />
      )}
      {cancel && (
        <AdminDialog
          title="Zrušit budoucí blokace?"
          description="Uvolní se pouze budoucí sloty této dávky. Ostatní blokace a rezervace zůstávají beze změny. Zákazníkům se nic neposílá."
          onClose={() => {
            if (!pending) setCancel(null);
          }}
        >
          <p className="mb-5 text-sm">
            {cancel.snapshot.templates
              .map((template) => template.name)
              .join(" + ")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await cancelBlockApplicationAction({
                    id: cancel.id,
                  });
                  if (result.ok) {
                    setCancel(null);
                    saved(`Zrušeno ${result.data.count} budoucích blokací.`);
                  } else setMessage(result.error);
                })
              }
            >
              {pending ? "Ruším…" : "Zrušit budoucí blokace"}
            </Button>
            <Button
              disabled={pending}
              variant="outline"
              onClick={() => setCancel(null)}
            >
              Ponechat blokace
            </Button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

function TemplateDialog({
  template,
  hours,
  onClose,
  onSaved,
}: {
  template: Template | null;
  hours: BlockingHours[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [slots, setSlots] = useState<BlockingSlot[]>(
    template?.slots.filter((slot) => slotFitsHours(slot, hours)) ?? [],
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <AdminDialog
      title={template ? "Upravit šablonu" : "Přidat šablonu"}
      description="Vyberte konkrétní sloty pro jednotlivé dny. Uložení šablony zatím žádné termíny neblokuje."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await saveBlockTemplateAction({
              id: template?.id,
              expectedUpdatedAt: template?.updatedAt,
              name,
              slots,
            });
            if (result.ok) onSaved();
            else setError(result.error);
          });
        }}
      >
        <div>
          <Label htmlFor="block-template-name">Název šablony</Label>
          <Input
            data-initial-focus
            id="block-template-name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2"
          />
        </div>
        {WEEK.map((day) => {
          const hoursForDay = hours.find((row) => row.dayOfWeek === day);
          const options: BlockingSlot[] = [];
          if (
            hoursForDay &&
            !hoursForDay.isClosed &&
            hoursForDay.slotMinutes > 0
          )
            for (
              let minute = hoursForDay.openMinute;
              minute + hoursForDay.slotMinutes <= hoursForDay.closeMinute;
              minute += hoursForDay.slotMinutes
            )
              options.push({
                dayOfWeek: day,
                startMinute: minute,
                endMinute: minute + hoursForDay.slotMinutes,
              });
          return (
            <fieldset key={day}>
              <legend className="mb-2 text-sm font-semibold">
                {WEEKDAYS[day]}
              </legend>
              {options.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {options.map((slot) => {
                    const key = blockSlotKey(slot);
                    const checked = slots.some(
                      (item) => blockSlotKey(item) === key,
                    );
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          setSlots((value) =>
                            checked
                              ? value.filter(
                                  (item) => blockSlotKey(item) !== key,
                                )
                              : [...value, slot],
                          )
                        }
                        className={cn(
                          "flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-medium transition-colors active:scale-[.98] motion-reduce:transform-none",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-accent",
                        )}
                      >
                        <span>
                          {minuteLabel(slot.startMinute)}–
                          {minuteLabel(slot.endMinute)}
                        </span>
                        {checked && (
                          <Check
                            aria-hidden="true"
                            className="size-3 shrink-0"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Zavřeno</p>
              )}
            </fieldset>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Vybráno slotů v týdnu: {slots.length}. Úprava platí jen pro další
          použití šablony.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !slots.length}>
            {pending ? "Ukládám…" : "Uložit šablonu"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Zrušit
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}

function ApplyDialog({
  selectedIds,
  templates,
  today,
  onClose,
  onSaved,
}: {
  selectedIds: string[];
  templates: Template[];
  today: string;
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [ids, setIds] = useState(selectedIds);
  const [mode, setMode] = useState<"range" | "dates">("range");
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(`${today.slice(0, 4)}-12-31`);
  const [date, setDate] = useState(today),
    [dates, setDates] = useState<string[]>([]);
  const [preview, setPreview] = useState<BlockPreview | null>(null);
  const [request, setRequest] = useState<BlockPreviewInput | null>(null);
  const [operationId, setOperationId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function changed() {
    setPreview(null);
    setRequest(null);
    setError("");
  }
  return (
    <AdminDialog
      title="Použít šablony"
      description="Vyberte termíny a zkontrolujte náhled. Blokace nikdy neruší zakoupené rezervace ani vstupní kódy."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const target: BlockTarget =
            mode === "range" ? { mode, from, to } : { mode, dates };
          const input = { templateIds: ids, target };
          start(async () => {
            setError("");
            const result = await previewBlockApplicationAction(input);
            if (result.ok) {
              setPreview(result.data);
              setRequest(input);
              setOperationId(crypto.randomUUID());
            } else {
              setPreview(null);
              setError(result.error);
            }
          });
        }}
      >
        <fieldset disabled={pending} className="grid gap-5">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Šablony</legend>
            {templates.map((template) => (
              <label
                key={template.id}
                className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(template.id)}
                  onChange={(event) => {
                    changed();
                    setIds((value) =>
                      event.target.checked
                        ? [...value, template.id]
                        : value.filter((id) => id !== template.id),
                    );
                  }}
                  className="size-4 accent-primary"
                />
                {template.name}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={pending} className="flex flex-wrap gap-4">
            <legend className="mb-2 text-sm font-semibold">Kdy blokovat</legend>
            {(
              [
                ["range", "Období od–do"],
                ["dates", "Jednotlivé dny"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="block-target"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    changed();
                    setMode(value);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {mode === "range" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="block-from">Od (včetně)</Label>
                <Input
                  id="block-from"
                  type="date"
                  min={today}
                  required
                  value={from}
                  onChange={(event) => {
                    changed();
                    setFrom(event.target.value);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="block-to">Do (včetně)</Label>
                <Input
                  id="block-to"
                  type="date"
                  min={from}
                  required
                  value={to}
                  onChange={(event) => {
                    changed();
                    setTo(event.target.value);
                  }}
                />
              </div>
              <Button
                className="sm:col-span-2"
                type="button"
                variant="outline"
                onClick={() => {
                  changed();
                  setTo(`${from.slice(0, 4)}-12-31`);
                }}
              >
                Do konce roku
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <Label htmlFor="block-date">Přidat kalendářní den</Label>
              <div className="flex gap-2">
                <Input
                  id="block-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!date}
                  onClick={() => {
                    changed();
                    setDates((value) => [...new Set([...value, date])].sort());
                  }}
                >
                  Přidat den
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dates.map((value) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={value}
                    aria-label={`Odebrat den ${value}`}
                    onClick={() => {
                      changed();
                      setDates((items) =>
                        items.filter((item) => item !== value),
                      );
                    }}
                  >
                    {value} ×
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={
              pending || ids.length === 0 || (mode === "dates" && !dates.length)
            }
          >
            {pending ? "Načítám…" : "Zobrazit náhled"}
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && request && (
        <div className="mt-5 space-y-4">
          <Notice tone="info" title={`Připraveno ${preview.count} blokací`}>
            <p>
              Překryvy s rezervacemi:{" "}
              {
                preview.conflicts.filter(
                  (item) => item.reservationIds.length > 0,
                ).length
              }
              . Existující rezervace zůstávají platné.
            </p>
            <p>
              Již blokované sloty:{" "}
              {
                preview.conflicts.filter((item) => item.blockIds.length > 0)
                  .length
              }
              .
            </p>
          </Notice>
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              Zobrazit konkrétní termíny
            </summary>
            <ul className="max-h-60 overflow-auto rounded-md border border-border p-3 text-sm">
              {preview.snapshot.windows.map((window) => (
                <li
                  key={window.startISO}
                  className="flex justify-between gap-3 border-b border-border py-2 last:border-0"
                >
                  <span>
                    {window.dateKey} · {window.label}
                  </span>
                  {preview.conflicts.find(
                    (item) => item.startISO === window.startISO,
                  )?.reservationIds.length ? (
                    <span className="font-semibold">Rezervace zachována</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await applyBlockTemplatesAction({
                  ...request,
                  operationId,
                  fingerprint: preview.fingerprint,
                });
                if (result.ok) onSaved(result.data.count);
                else {
                  setPreview(null);
                  setError(result.error);
                }
              })
            }
          >
            <Ban className="mr-2 size-4" aria-hidden="true" />
            {pending ? "Ukládám…" : `Zablokovat ${preview.count} slotů`}
          </Button>
        </div>
      )}
      <Button
        variant="ghost"
        className="mt-4"
        disabled={pending}
        onClick={onClose}
      >
        Zavřít
      </Button>
    </AdminDialog>
  );
}
