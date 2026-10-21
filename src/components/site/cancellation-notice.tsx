import type { ReactNode } from "react";
import { renderNotice, type NoticeFields } from "@/lib/config/public-notices";

/** Shared read-only wording. All effects and confirmations remain in the callers. */
export function CancellationNotice({
  copy,
  variables,
  insideCutoff,
  preview = false,
  edit,
}: {
  copy: NoticeFields;
  variables: Record<string, string>;
  insideCutoff: boolean;
  preview?: boolean;
  edit?: (field: string) => ReactNode;
}) {
  const text = (field: string) =>
    edit ? edit(field) : renderNotice(copy[field] ?? "", variables);
  return (
    <>
      <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6">
        <p className="whitespace-pre-line">{text("body")}</p>
        <p className="mt-3 whitespace-pre-line font-bold">{text("refund")}</p>
        {insideCutoff ? (
          <p className="mt-3 whitespace-pre-line">{text("cutoff")}</p>
        ) : null}
      </div>
      <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
        {text("scope")}{" "}
        {preview
          ? "V ukázkovém náhledu se storno pouze nasimuluje a žádný e-mail se neposílá."
          : text("delivery")}
      </p>
    </>
  );
}
