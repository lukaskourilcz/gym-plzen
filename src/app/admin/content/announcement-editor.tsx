"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { announcementSchema, type Announcement } from "@/lib/config/opening";
import { receiveAction } from "@/lib/helpers/action-response";
import { AdminSwitch } from "@/components/admin/switch";
import { AdminDialog } from "@/components/admin/dialog";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveAnnouncementAction } from "./actions";
import "./content-canvas.css";

const labels = { title: "Hlavní text lišty", secondLine: "Druhý řádek" };

/** Every save replaces only the banner setting; turning it off retains both lines. */
export function AnnouncementEditor({
  initialValue,
}: {
  initialValue: Announcement;
}) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState<"title" | "secondLine" | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);

  async function save(next: Announcement) {
    const parsed = announcementSchema.safeParse(next);
    setSuccess(null);
    setError(null);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Zkontrolujte text lišty.");
      return;
    }
    setSaving(true);
    const response = await receiveAction(() =>
      saveAnnouncementAction(parsed.data),
    );
    setSaving(false);
    if (!response.received) {
      setUncertain(true);
      setError(
        "Uložení se nepodařilo potvrdit. Obnovte stránku a ověřte aktuální stav lišty.",
      );
      return;
    }
    if (!response.result.ok) {
      setError(response.result.error);
      return;
    }
    setValue(response.result.data);
    setEditing(null);
    setSuccess(
      response.result.data.enabled
        ? "Lišta je uložená a zobrazuje se na webu."
        : "Lišta je vypnutá. Texty zůstávají uložené.",
    );
  }
  const disabled = saving || uncertain;
  function edit(field: "title" | "secondLine") {
    setDraft(value[field]);
    setEditing(field);
    setError(null);
    setSuccess(null);
  }
  function pencil(field: "title" | "secondLine") {
    return (
      <button
        type="button"
        className="canvas-pencil"
        aria-label={`Upravit: ${labels[field]}`}
        disabled={disabled}
        onClick={() => edit(field)}
      >
        <Pencil aria-hidden="true" className="size-3.5" />
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid gap-4 border-b border-border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label
              htmlFor="announcement-enabled"
              className="cursor-pointer font-semibold"
            >
              Ukazovat oznamovací lištu
            </label>
            <p
              id="announcement-help"
              className="mt-1 text-sm text-muted-foreground"
            >
              {value.enabled
                ? "Zapnuto. Lišta se zobrazuje pod úvodním kalendářem."
                : "Vypnuto. Na webu se lišta nezobrazuje, texty můžete dál upravovat."}
            </p>
          </div>
          <AdminSwitch
            id="announcement-enabled"
            checked={value.enabled}
            onCheckedChange={(enabled) => void save({ ...value, enabled })}
            disabled={disabled}
            aria-describedby="announcement-help"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label
              htmlFor="announcement-second-line"
              className="cursor-pointer text-sm font-semibold"
            >
              Ukazovat druhý řádek
            </label>
            <p
              id="announcement-second-help"
              className="mt-1 text-sm text-muted-foreground"
            >
              Vypněte pro lištu jen s jedním tučným textem. Text druhého řádku
              se nesmaže.
            </p>
          </div>
          <AdminSwitch
            id="announcement-second-line"
            checked={value.showSecondLine}
            onCheckedChange={(showSecondLine) =>
              void save({ ...value, showSecondLine })
            }
            disabled={disabled}
            aria-describedby="announcement-second-help"
          />
        </div>
        {!editing ? <FormFeedback error={error} success={success} /> : null}
        {saving ? (
          <p role="status" className="text-sm text-muted-foreground">
            Ukládám lištu…
          </p>
        ) : null}
        {uncertain ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Obnovit a ověřit stav
          </Button>
        ) : null}
      </div>
      <div className="p-5">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">
          {value.enabled
            ? "Náhled lišty"
            : "Náhled vypnuté lišty — na webu není vidět"}
        </p>
        <div
          className="content-canvas overflow-hidden rounded-md border border-border"
          role="region"
          aria-label="Upravitelné rozložení: Oznamovací lišta"
        >
          <div className="bg-gold px-4 py-3 text-center text-gold-foreground">
            <p className="text-sm font-extrabold leading-6 sm:text-base">
              {value.title}
              {pencil("title")}
            </p>
            {value.showSecondLine ? (
              <p className="mt-1 text-xs leading-5">
                {value.secondLine || "Doplňte text druhého řádku"}
                {pencil("secondLine")}
              </p>
            ) : null}
          </div>
          {!value.showSecondLine ? (
            <div className="canvas-meta flex items-center justify-between gap-3 bg-background p-3 text-muted-foreground">
              <span>
                Druhý řádek je skrytý.
                {value.secondLine ? ` Uložený text: ${value.secondLine}` : ""}
              </span>
              {pencil("secondLine")}
            </div>
          ) : null}
        </div>
      </div>
      {editing ? (
        <AdminDialog
          title={`Upravit: ${labels[editing]}`}
          description="Uložený text se projeví v náhledu i na webu, pokud je lišta zapnutá."
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save({ ...value, [editing]: draft });
            }}
          >
            <Textarea
              data-initial-focus
              aria-label={`Text: ${labels[editing]}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={editing === "title" ? 500 : 1000}
              rows={4}
              disabled={disabled}
            />
            {editing === "secondLine" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Druhý řádek je nepovinný. Prázdný text se na webu nezobrazí.
              </p>
            ) : null}
            <FormFeedback error={error} />
            {uncertain ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Obnovit a ověřit stav
              </Button>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <SubmitButton isSubmitting={saving} disabled={uncertain}>
                Uložit změny
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Zrušit
              </Button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
}
