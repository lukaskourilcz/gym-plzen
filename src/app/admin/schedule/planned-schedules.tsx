"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminDialog } from "@/components/admin/dialog";
import { FormFeedback } from "@/components/admin/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatMoney,
  hhmmToMinutes,
  minutesToHHmm,
} from "@/lib/helpers/format";
import {
  MAX_PLANNED_WINDOWS,
  plannedScheduleInputSchema,
  type PlannedSchedule,
} from "@/lib/config/planned-schedules";
import { changePlannedScheduleAction } from "./actions";

const DAYS = [
  [1, "Po"],
  [2, "Út"],
  [3, "St"],
  [4, "Čt"],
  [5, "Pá"],
  [6, "So"],
  [0, "Ne"],
] as const;

function dateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export function PlannedSchedules({
  schedules,
  today,
  readOnly,
}: {
  schedules: PlannedSchedule[];
  today: string;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState<PlannedSchedule | "new" | null>(null);
  const [removing, setRemoving] = useState<PlannedSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef(false);

  async function remove() {
    if (!removing || request.current) return;
    request.current = true;
    setBusy(true);
    setError(null);
    try {
      const { id, revision } = removing;
      const result = await changePlannedScheduleAction({
        id,
        revision,
        remove: true,
      });
      if (!result.ok) return setError(result.error);
      setRemoving(null);
      setNotice("Rozvrh byl odebrán.");
    } catch {
      setError("Rozvrh se nepodařilo odebrat. Zkuste to znovu.");
    } finally {
      request.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="planned-schedules-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="planned-schedules-heading" className="text-lg font-semibold">
            Plánované rozvrhy
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Nastavte vlastní časy a ceny pro vybrané dny a období. V ostatní dny
            platí běžná týdenní otevírací doba.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={readOnly}>
          <Plus aria-hidden="true" /> Přidat rozvrh
        </Button>
      </div>
      <FormFeedback success={notice} />
      {schedules.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Zatím nemáte žádný plánovaný rozvrh.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {schedules.map((schedule) => {
            const status =
              schedule.to < today
                ? "Ukončený"
                : schedule.from > today
                  ? "Naplánovaný"
                  : "Platí";
            const prices = schedule.windows.map((window) => window.priceCents);
            const low = Math.min(...prices),
              high = Math.max(...prices);
            return (
              <li
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{schedule.name}</h3>
                    <Badge variant={status === "Platí" ? "accent" : "outline"}>
                      {status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dateLabel(schedule.from)} – {dateLabel(schedule.to)} ·{" "}
                    {schedule.weekdays.length === 7
                      ? "Denně"
                      : DAYS.filter(([day]) => schedule.weekdays.includes(day))
                          .map(([, label]) => label)
                          .join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Počet oken za den {schedule.windows.length} ·{" "}
                    {low === high
                      ? formatMoney(low)
                      : `${formatMoney(low)} – ${formatMoney(high)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {status !== "Ukončený" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(schedule)}
                      aria-label={`Upravit rozvrh ${schedule.name}`}
                    >
                      Upravit
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setRemoving(schedule);
                    }}
                    aria-label={`Odebrat rozvrh ${schedule.name}`}
                  >
                    Odebrat
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <ScheduleEditor
          current={editing === "new" ? undefined : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            setNotice("Rozvrh byl uložen.");
          }}
        />
      )}
      {removing && (
        <AdminDialog
          title={`Odebrat rozvrh „${removing.name}“?`}
          description="Pro nové rezervace v tomto období se znovu použije běžná otevírací doba. Stávající rezervace platí dál."
          busy={busy}
          onClose={() => setRemoving(null)}
        >
          <FormFeedback error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Ponechat
            </Button>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {busy ? "Odebírám…" : "Odebrat rozvrh"}
            </Button>
          </div>
        </AdminDialog>
      )}
    </section>
  );
}

type WindowRow = { key: number; start: string; end: string; price: string };
const INPUT_LABEL = "grid min-w-0 gap-1 text-sm font-medium";

function LabeledInput({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={INPUT_LABEL}>
      {label}
      {children}
    </label>
  );
}

function ScheduleEditor({
  current,
  today,
  onClose,
  onSave,
}: {
  current?: PlannedSchedule;
  today: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(
    current?.weekdays ?? DAYS.map(([day]) => day),
  );
  const [rows, setRows] = useState<WindowRow[]>(() =>
    (current?.windows ?? []).map((window, key) => ({
      key,
      start: minutesToHHmm(window.startMinute),
      end: minutesToHHmm(window.endMinute),
      price: String(window.priceCents / 100),
    })),
  );
  const [generator, setGenerator] = useState({
    start: "06:00",
    end: "22:00",
    minutes: "80",
    price: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nextKey = useRef(rows.length);
  const request = useRef(false);

  function generate() {
    const start = hhmmToMinutes(generator.start),
      end = hhmmToMinutes(generator.end);
    const minutes = Number(generator.minutes),
      price = Number(generator.price);
    if (
      start === null ||
      end === null ||
      end <= start ||
      !Number.isInteger(minutes) ||
      minutes <= 0 ||
      price <= 0 ||
      price > 10000
    ) {
      setGeneratorError(
        "Vyplňte čas od–do, délku okna a cenu od 0,01 do 10 000 Kč.",
      );
      return;
    }
    const count = (end - start) / minutes;
    if (!Number.isInteger(count) || count > MAX_PLANNED_WINDOWS) {
      setGeneratorError(
        `Období se musí rozdělit na celá okna stejné délky (nejvýše ${MAX_PLANNED_WINDOWS}).`,
      );
      return;
    }
    setRows(
      Array.from({ length: count }, (_, i) => ({
        key: nextKey.current++,
        start: minutesToHHmm(start + i * minutes),
        end: minutesToHHmm(start + (i + 1) * minutes),
        price: generator.price,
      })),
    );
    setGeneratorError(null);
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const data = new FormData(event.currentTarget);
    const input = plannedScheduleInputSchema.safeParse({
      id: current?.id,
      revision: current?.revision,
      name: data.get("name"),
      from: data.get("from"),
      to: data.get("to"),
      weekdays,
      windows: rows.map((row) => ({
        startMinute: hhmmToMinutes(row.start),
        endMinute: hhmmToMinutes(row.end),
        priceCents: Math.round(Number(row.price) * 100),
      })),
    });
    if (!input.success) {
      const field = input.error.issues[0];
      const specific =
        field?.path[0] === "weekdays"
          ? "Vyberte alespoň jeden den v týdnu."
          : field?.path[0] === "windows" && rows.length === 0
            ? "Přidejte alespoň jedno časové okno."
            : field?.code === "custom"
              ? field.message
              : "Zkontrolujte název, data, časy a ceny.";
      setError(specific);
      return;
    }
    request.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await changePlannedScheduleAction(input.data);
      if (!result.ok) return setError(result.error);
      onSave();
    } catch {
      setError("Rozvrh se nepodařilo uložit. Zkuste to znovu.");
    } finally {
      request.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      title={current ? "Upravit rozvrh" : "Přidat rozvrh"}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={save} className="grid gap-5">
        <fieldset disabled={busy} className="grid min-w-0 gap-4">
          <LabeledInput label="Název rozvrhu">
            <Input
              data-initial-focus
              name="name"
              required
              maxLength={100}
              defaultValue={current?.name}
              placeholder="Např. Lednový rozvrh"
            />
          </LabeledInput>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Platí od">
              <Input
                name="from"
                type="date"
                required
                min={current && current.from < today ? current.from : today}
                max="2099-12-31"
                defaultValue={current?.from}
              />
            </LabeledInput>
            <LabeledInput label="Platí do (včetně)">
              <Input
                name="to"
                type="date"
                required
                min={today}
                max="2099-12-31"
                defaultValue={current?.to}
              />
            </LabeledInput>
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-1 text-sm font-semibold">Dny v týdnu</legend>
            <div className="flex flex-wrap gap-x-3">
              {DAYS.map(([day, label]) => (
                <label
                  key={day}
                  className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={weekdays.includes(day)}
                    onChange={(event) => {
                      setWeekdays(
                        event.target.checked
                          ? [...weekdays, day]
                          : weekdays.filter((value) => value !== day),
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <details
            className="rounded-md border border-border p-3"
            open={current ? undefined : true}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Vygenerovat navazující okna
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <LabeledInput label="První začátek">
                <Input
                  type="time"
                  value={generator.start}
                  onChange={(e) =>
                    setGenerator({ ...generator, start: e.target.value })
                  }
                />
              </LabeledInput>
              <LabeledInput label="Poslední konec">
                <Input
                  type="time"
                  value={generator.end}
                  onChange={(e) =>
                    setGenerator({ ...generator, end: e.target.value })
                  }
                />
              </LabeledInput>
              <LabeledInput label="Délka (min)">
                <Input
                  type="number"
                  value={generator.minutes}
                  onChange={(e) =>
                    setGenerator({ ...generator, minutes: e.target.value })
                  }
                />
              </LabeledInput>
              <LabeledInput label="Cena okna (Kč)">
                <Input
                  type="number"
                  step="any"
                  value={generator.price}
                  onChange={(e) =>
                    setGenerator({ ...generator, price: e.target.value })
                  }
                />
              </LabeledInput>
            </div>
            <div className="mt-3">
              <FormFeedback error={generatorError} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={generate}
            >
              {rows.length ? "Nahradit seznam oken" : "Vygenerovat okna"}
            </Button>
          </details>
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">
              Časová okna{" "}
              <span className="font-normal text-muted-foreground">
                ({rows.length})
              </span>
            </h3>
            {rows.map((row, index) => (
              <div
                key={row.key}
                role="group"
                aria-label={`Okno ${index + 1}`}
                className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                {(
                  [
                    ["start", "Od", "time"],
                    ["end", "Do", "time"],
                    ["price", "Cena (Kč)", "number"],
                  ] as const
                ).map(([key, label, type]) => (
                  <LabeledInput key={key} label={label}>
                    <Input
                      required
                      type={type}
                      min={type === "number" ? "0.01" : undefined}
                      max={type === "number" ? "10000" : undefined}
                      step={type === "number" ? "0.01" : undefined}
                      value={row[key]}
                      onChange={(event) =>
                        setRows(
                          rows.map((item) =>
                            item.key === row.key
                              ? { ...item, [key]: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </LabeledInput>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label={`Odebrat okno ${index + 1}`}
                  onClick={() =>
                    setRows(rows.filter((item) => item.key !== row.key))
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              disabled={rows.length >= MAX_PLANNED_WINDOWS}
              onClick={() =>
                setRows([
                  ...rows,
                  {
                    key: nextKey.current++,
                    start: rows.at(-1)?.end ?? "",
                    end: "",
                    price: rows.at(-1)?.price ?? "",
                  },
                ])
              }
            >
              <Plus aria-hidden="true" /> Přidat okno
            </Button>
          </div>
        </fieldset>
        <p className="text-sm text-muted-foreground">
          Rozvrh se řídí datem návštěvy. V překryvu s cenovou akcí platí cena
          akce. Existující rezervace platí dál za původních podmínek.
        </p>
        <FormFeedback error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Zavřít
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Ukládám…" : "Uložit rozvrh"}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
