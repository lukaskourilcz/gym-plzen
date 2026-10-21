"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/admin/form-controls";
import { uploadFileAction } from "../settings/actions";
import { receiveAction } from "@/lib/helpers/action-response";

/** Reuses the existing authorized media upload; choosing a file does not publish it. */
export function ContentImageUpload({
  onUploaded,
  disabled,
}: {
  onUploaded: (url: string) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Vybrat novou fotografii"
        className="sr-only"
        disabled={busy || disabled}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          setError(null);
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
            file.size > 8 * 1024 * 1024
          ) {
            setError("Vyberte obrázek JPG, PNG nebo WebP, nejvýše 8 MB.");
            return;
          }
          const data = new FormData();
          data.set("file", file);
          setBusy(true);
          const response = await receiveAction(() => uploadFileAction(data));
          setBusy(false);
          if (!response.received) {
            setError("Nahrání se nepodařilo potvrdit. Zkuste to znovu.");
            return;
          }
          if (!response.result.ok) {
            setError(response.result.error);
            return;
          }
          onUploaded(response.result.data.url);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy || disabled}
        onClick={() => input.current?.click()}
        className="justify-self-start"
      >
        <Upload aria-hidden="true" />
        {busy ? "Nahrávám…" : "Nahrát novou fotografii"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        JPG, PNG nebo WebP do 8 MB. Na webu se změní až po uložení fotografie.
      </p>
      <FormFeedback error={error} />
    </div>
  );
}
