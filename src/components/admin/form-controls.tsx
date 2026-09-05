"use client";

import * as React from "react";
import type { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Shared form building blocks used by every admin/login form (Tailwind +
 * shadcn/ui). They pair with `useActionForm` (React Hook Form + Zod): `Field`
 * renders a label + the RHF field error, `FormFeedback` the top-level message,
 * and `SubmitButton` the submitting state.
 */

/**
 * A labelled field that renders its RHF validation error.
 *
 * The error is wired to the control with `aria-describedby` / `aria-invalid`.
 * React Hook Form focuses the first invalid field on submit, so without this a
 * screen-reader user lands on a control that announces nothing while the reason
 * sits visibly beneath it.
 */
export function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: FieldError;
  children: React.ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="mb-4">
      <Label htmlFor={name}>{label}</Label>
      {error?.message
        ? describeControl(children, { errorId, invalid: true })
        : children}
      {error?.message && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}

/**
 * Attach the error's id to the field's control. `Field` takes the control as
 * `children` so every caller keeps its own input component; cloning is what
 * lets one shared wrapper describe all of them without changing that contract.
 * An element that already sets `aria-describedby` keeps its own value.
 */
function describeControl(
  children: React.ReactNode,
  { errorId, invalid }: { errorId: string; invalid: boolean },
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const props = child.props as {
      "aria-describedby"?: string;
      "aria-invalid"?: boolean | "true" | "false";
    };
    return React.cloneElement(child, {
      "aria-describedby": props["aria-describedby"] ?? errorId,
      "aria-invalid": props["aria-invalid"] ?? invalid,
    } as Partial<typeof props>);
  });
}

/** Top-level success/error banner for a form. */
export function FormFeedback({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error)
    return (
      <p role="alert" className="mt-1 text-sm text-destructive">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="mt-1 text-sm font-medium text-success">
        {success}
      </p>
    );
  return null;
}

/** Submit button that disables while the form is submitting. */
export function SubmitButton({
  isSubmitting,
  disabled = false,
  children = "Uložit",
  pendingLabel = "Ukládám…",
  className,
  variant,
}: {
  isSubmitting: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  /** Secondary submits (an undo, a revoke) use the outline variant. */
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || isSubmitting}
      className={className}
    >
      {isSubmitting ? pendingLabel : children}
    </Button>
  );
}

/** Inline checkbox + label row, used across admin forms. */
export function CheckboxField({
  name,
  label,
  register,
}: {
  name: string;
  label: string;
  register: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <label className="mb-2.5 flex items-center gap-2 text-sm">
      <input
        id={name}
        type="checkbox"
        className="size-4 rounded border-input accent-[var(--color-primary)]"
        {...register}
      />
      {label}
    </label>
  );
}
