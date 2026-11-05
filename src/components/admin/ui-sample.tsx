"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard, StatGroup } from "./stat-card";
import { History } from "lucide-react";
import { IconButton } from "./ui/icon-button";
import { DialogPagination } from "./ui/pagination";
import { AdminDialog } from "./dialog";
import { DailyProgrammeRow } from "./daily-programme";

const SAMPLE_NOW = Date.parse("2026-11-05T10:00:00Z");

/** Local gallery example: exercises native form semantics without a server action. */
export function AdminUiSample() {
  const [price, setPrice] = useState("229");
  const [message, setMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  return (
    <section className="my-8" aria-labelledby="kit-boardui">
      <h2 id="kit-boardui" className="mb-2">
        Jednotný styl administrace · BoardUI
      </h2>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        Klidné plochy, společná typografie a nativní formuláře. Tato ukázka mění
        pouze místní stav galerie; nic se neukládá na server.
      </p>
      <StatGroup className="mb-6">
        <StatCard label="Ukázková cena" value={`${price || "0"} Kč`} />
        <StatCard label="Délka tréninku" value="75 min" />
      </StatGroup>
      <form
        aria-label="Ukázkový formulář BoardUI"
        className="max-w-xl rounded-lg border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(`Ukázka potvrzena: ${price} Kč.`);
        }}
      >
        <Label htmlFor="kit-boardui-price">Ukázková cena (Kč)</Label>
        <Input
          id="kit-boardui-price"
          type="number"
          required
          min="1"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button>Potvrdit ukázku</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPrice("229");
              setMessage("Ukázka obnovena.");
            }}
          >
            Obnovit ukázku
          </Button>
          <Button type="button" disabled>
            Probíhá ukládání
          </Button>
        </div>
        <p role="status" className="mt-3 text-sm text-accent-foreground">
          {message}
        </p>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Badge>Potvrzená rezervace</Badge>
        <Badge variant="muted">Čeká na platbu</Badge>
        <Button href="/admin/schedule" variant="link">
          Otevírací doba a bloky →
        </Button>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-5 py-3">
        <span className="text-muted-foreground">Kredity zákazníka:</span>
        <span className="font-medium">0 Kč</span>
        <IconButton
          icon={History}
          aria-label="Ukázka historie kreditů"
          aria-haspopup="dialog"
          onClick={() => setHistoryOpen(true)}
        />
      </div>
      <h3 className="mb-3 mt-6">Kompaktní denní program · ukázka</h3>
      <div
        role="list"
        aria-label="Ukázkový denní program"
        data-ui="programme-list"
      >
        {[
          {
            id: "sample-success",
            name: "Ukázkový úspěšný vstup",
            used: true,
            future: false,
          },
          {
            id: "sample-missing",
            name: "Ukázkový nepotvrzený vstup",
            used: false,
            future: false,
          },
          {
            id: "sample-future",
            name: "Ukázková budoucí rezervace",
            used: false,
            future: true,
          },
        ].map((sample) => (
          <DailyProgrammeRow
            key={sample.id}
            now={SAMPLE_NOW}
            booking={{
              id: sample.id,
              name: sample.name,
              startsAt: sample.future
                ? "2026-11-05T11:00:00Z"
                : "2026-11-05T09:00:00Z",
              endsAt: sample.future
                ? "2026-11-05T12:00:00Z"
                : "2026-11-05T11:00:00Z",
              free: false,
              codeCreated: true,
              codeSent: !sample.future,
              codeUsed: sample.used,
            }}
          />
        ))}
      </div>
      {historyOpen && (
        <AdminDialog
          title="Ukázka historie kreditů"
          onClose={() => setHistoryOpen(false)}
        >
          <p className="my-4 text-sm">
            Ukázková stránka {historyPage}. Galerie nemění skutečná data.
          </p>
          <DialogPagination
            aria-label="Ukázkové stránkování historie"
            page={historyPage}
            totalPages={3}
            onChange={setHistoryPage}
          />
        </AdminDialog>
      )}
    </section>
  );
}
