"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/admin/form-controls";
import { unsubscribeNewsletterAction } from "../actions";

export function UnsubscribeForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done)
    return (
      <p role="status" className="mt-6 leading-7">
        Hotovo. Adresa <strong>{email}</strong> už od nás novinky dostávat
        nebude.
      </p>
    );

  return (
    <div className="mt-6">
      <p className="leading-7">
        Chcete přestat dostávat novinky na adresu <strong>{email}</strong>?
      </p>
      <Button
        type="button"
        className="mt-5"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await unsubscribeNewsletterAction({ email, token });
            if (result.ok) setDone(true);
            else setError(result.error);
          })
        }
      >
        {pending ? "Odhlašuji…" : "Odhlásit z novinek"}
      </Button>
      <FormFeedback error={error} />
    </div>
  );
}
