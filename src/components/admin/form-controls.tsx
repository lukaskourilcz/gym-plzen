"use client";

import type { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Shared form building blocks used by every admin/login form (Tailwind +
 * shadcn/ui). They pair with `useActionForm` (React Hook Form + Zod): `Field`
 * renders a label + the RHF field error, `FormFeedback` the top-level message,
 * and `SubmitButton` the submitting state.
 */

/** A labelled field that renders its RHF validation error. */
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
  return (
    <div className="mb-4">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error?.message && (
        <p className="mt-1 text-xs text-destructive">{error.message}</p>
      )}
    </div>
  );
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
  children = "Uložit",
  className,
}: {
  isSubmitting: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Button type="submit" disabled={isSubmitting} className={className}>
      {isSubmitting ? "Ukládám…" : children}
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
