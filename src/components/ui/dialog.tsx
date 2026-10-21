"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/** Public-site modal: native modality, Escape, initial focus and focus restoration. */
export function Dialog({
  title,
  description,
  children,
  onClose,
  busy = false,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(),
    descriptionId = useId();
  useEffect(() => {
    const element = ref.current,
      previous = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
      className={cn(
        "m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-md backdrop:bg-black/40 sm:p-7",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-xl font-extrabold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy}
          aria-label="Zavřít dialog"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {description ? (
        <p id={descriptionId} className="mt-3 font-bold">
          {description}
        </p>
      ) : null}
      {children}
    </dialog>
  );
}

export const DIALOG_BUTTON_CLASS =
  "h-auto min-h-11 w-full min-w-0 whitespace-normal px-3 py-2 text-center";
export function DialogActions({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "mt-5 grid items-stretch gap-3",
        columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}
