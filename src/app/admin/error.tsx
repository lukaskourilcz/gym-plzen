"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Honest failure state for protected operational pages. */
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="max-w-2xl border border-destructive/35 bg-card p-6 shadow-sm"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mb-4 size-6 text-destructive"
      />
      <h1 className="text-2xl font-extrabold">Data se nepodařilo načíst</h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        Administrace teď nemůže bezpečně ověřit aktuální údaje. Zkuste načtení
        zopakovat. Pokud problém trvá, zkontrolujte připojení databáze.
      </p>
      <Button type="button" className="mt-5" onClick={reset}>
        Zkusit znovu
      </Button>
    </div>
  );
}
