"use client";
import { useState } from "react";
import Image from "next/image";
import type { ContentAsset } from "@/lib/content/editor-visuals";
import { contentAssetSchema } from "@/lib/validations/content-asset";
import { Input } from "@/components/ui/input";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { receiveAction } from "@/lib/helpers/action-response";
import { ContentImageUpload } from "./image-upload";
import { saveContentAssetAction } from "./actions";

export function AssetEditor({
  asset,
  value,
  saved,
}: {
  asset: ContentAsset;
  value: string;
  saved: (value: string) => void;
}) {
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-md border border-border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        const input = contentAssetSchema.safeParse({
          key: asset.key,
          value: current,
        });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? "Zkontrolujte údaj.");
          return;
        }
        setBusy(true);
        const response = await receiveAction(() =>
          saveContentAssetAction(input.data),
        );
        setBusy(false);
        if (!response.received) {
          setError("Uložení se nepodařilo potvrdit. Zkuste to znovu.");
          return;
        }
        if (!response.result.ok) {
          setError(response.result.error);
          return;
        }
        saved(input.data.value);
        setSuccess("Změna je uložená a projeví se na webu.");
      }}
    >
      <label className="grid gap-2 text-sm font-bold">
        {asset.label}
        <Input
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          required
          maxLength={asset.kind === "text" ? 180 : 2048}
          placeholder={
            asset.kind === "image" ? "https://…/fotografie.webp" : undefined
          }
        />
      </label>
      {asset.kind === "image" ? (
        <div className="flex flex-wrap items-center gap-4">
          <Image
            src={
              contentAssetSchema.safeParse({ key: asset.key, value: current })
                .success
                ? current
                : value
            }
            alt={`Náhled: ${asset.label}`}
            width={180}
            height={110}
            unoptimized
            className="h-24 w-40 rounded-md border border-border object-cover"
          />
          <ContentImageUpload
            disabled={busy}
            onUploaded={(url) => {
              setCurrent(url);
              setSuccess(
                "Fotografie je nahraná. Zkontrolujte náhled a zvolte Uložit fotografii.",
              );
              setError(null);
            }}
          />
        </div>
      ) : null}
      <FormFeedback error={error} success={success} />
      <SubmitButton isSubmitting={busy} className="justify-self-start">
        Uložit {asset.kind === "image" ? "fotografii" : "popis"}
      </SubmitButton>
    </form>
  );
}
