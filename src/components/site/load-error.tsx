"use client";

import { useEffect } from "react";
import { reportTransportError } from "@/lib/helpers/report-transport-error";
import { Button } from "@/components/ui/button";

/** A manual GET recovery; no payment or Server Action is replayed automatically. */
export function LoadError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportTransportError(error, "page.render");
  }, [error]);
  return (
    <main
      role="alert"
      style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}
    >
      <h1 className="text-3xl font-extrabold">Stránku se nepodařilo načíst</h1>
      <p className="mt-4 leading-7">
        Zkontrolujte připojení a obnovte stránku. Vybrané termíny zůstanou v
        jejím odkazu.
      </p>
      <p className="mt-3 leading-7 text-muted-foreground">
        Pokud jste právě odeslali rezervaci nebo platbu, před dalším pokusem
        ověřte její stav v účtu nebo v potvrzovacím e-mailu.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => window.location.assign(window.location.href)}
        >
          Obnovit stránku
        </Button>
        <Button href="/account" variant="outline">
          Zkontrolovat rezervace v účtu
        </Button>
      </div>
    </main>
  );
}
