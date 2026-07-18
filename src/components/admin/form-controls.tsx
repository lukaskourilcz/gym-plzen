"use client";

import type { FieldError } from "react-hook-form";

/**
 * Shared, unstyled form building blocks used by every admin/login form. They
 * pair with `useActionForm` (React Hook Form + Zod): `Field` renders a label +
 * the RHF field error, `FormFeedback` renders the top-level server message, and
 * `SubmitButton` reflects the form's submitting state.
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
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error?.message && <p className="field-error">{error.message}</p>}
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
  if (error) return <p className="form-error">{error}</p>;
  if (success) return <p className="form-ok">{success}</p>;
  return null;
}

/** Submit button that disables while the form is submitting. */
export function SubmitButton({
  isSubmitting,
  children = "Uložit",
}: {
  isSubmitting: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Ukládám…" : children}
    </button>
  );
}
