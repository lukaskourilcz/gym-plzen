"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** Public-site modal: native modality, Escape, initial focus and focus restoration. */
export function Dialog({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
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
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 text-foreground shadow-md backdrop:bg-black/40 sm:p-7"
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
