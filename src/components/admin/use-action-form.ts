"use client";

import { useState } from "react";
import {
  useForm,
  type DefaultValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Result } from "@/lib/helpers/result";

/**
 * Bridges React Hook Form + Zod with our server actions.
 *
 * - Client-side validation uses `zodResolver(schema)` — the SAME schema the
 *   server action re-validates with, so rules live in one place
 *   (`@/lib/validations/*`).
 * - On submit it calls the action (which returns a `Result`) and maps any
 *   server-side field errors back onto the form, plus a top-level message.
 *
 * Every admin/login form is built on this hook.
 */
export function useActionForm<S extends z.ZodTypeAny>(config: {
  schema: S;
  action: (input: z.infer<S>) => Promise<Result<unknown>>;
  defaultValues?: DefaultValues<z.infer<S>>;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}): {
  form: UseFormReturn<z.infer<S>>;
  submit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  serverError: string | null;
  success: string | null;
} {
  type Values = z.infer<S>;
  const form = useForm<Values>({
    resolver: zodResolver(config.schema),
    defaultValues: config.defaultValues,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    const result = await config.action(values);
    if (result.ok) {
      setSuccess(config.successMessage ?? "Uloženo.");
      if (config.resetOnSuccess) form.reset();
      config.onSuccess?.();
    } else {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          form.setError(field as Path<Values>, { message: messages[0] });
        }
      }
    }
  });

  return { form, submit, serverError, success };
}
