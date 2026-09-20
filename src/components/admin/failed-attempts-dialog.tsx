"use client";

import { useId, useRef } from "react";
import { formatDateTime } from "@/lib/helpers/format";

export type FailedAttempt = { id: string; at: string; reason: string };

export function FailedAttemptsDialog({ attempts, unavailable, unassigned = false }: {
  attempts: FailedAttempt[]; unavailable: boolean; unassigned?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return <>
    <button type="button" className="min-h-11 text-sm font-semibold underline underline-offset-4"
      aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      {unassigned ? `Nepřiřazené neúspěšné pokusy (${attempts.length})` : `${attempts.length} pokusů`}
      {unavailable ? " (neúplné údaje)" : ""}
    </button>
    <dialog ref={dialog} aria-labelledby={title}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[min(48rem,calc(100%-2rem))] overflow-auto rounded-lg border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 id={title} className="text-xl font-bold">{unassigned ? "Nepřiřazené neúspěšné pokusy" : "Neúspěšné pokusy o vstup"}</h2>
        <button type="button" autoFocus className="min-h-11 rounded-md border px-3 text-sm" onClick={() => dialog.current?.close()}>Zavřít</button>
      </div>
      <p className="mb-3 text-sm">Počet zaznamenaných pokusů: <strong>{attempts.length}</strong>.</p>
      <p className="mb-4 text-sm text-muted-foreground">Nuki neposkytuje číslice nesprávně zadaných kódů.
        {unassigned ? " Tyto pokusy nelze přiřadit ke konkrétnímu kódu ani zákazníkovi." : " Zobrazené pokusy Nuki přiřadilo k tomuto kódu. Překlepy bez rozpoznané autorizace jsou v přehledu nepřiřazených pokusů."}
      </p>
      {unavailable && <p role="status" className="mb-4 text-sm">Historii se nepodařilo načíst celou. Počet zahrnuje pouze dostupné uložené záznamy.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="p-2">Čas pokusu</th><th className="p-2">Počet</th><th className="p-2">Důvod selhání</th><th className="p-2">Zadaný kód</th></tr></thead>
        <tbody>{attempts.map(attempt => <tr key={attempt.id} className="border-b">
          <td className="whitespace-nowrap p-2">{formatDateTime(new Date(attempt.at))}</td><td className="p-2">1</td>
          <td className="p-2">{attempt.reason}</td><td className="p-2 text-muted-foreground">Nuki neposkytuje</td>
        </tr>)}
        {!attempts.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">V dostupné historii nejsou zaznamenané neúspěšné pokusy.</td></tr>}</tbody>
      </table></div>
      <p className="mt-3 text-xs text-muted-foreground">Časy jsou uvedené v českém čase. Nové pokusy se objeví po synchronizaci zámku a obnovení stránky.</p>
    </dialog>
  </>;
}
