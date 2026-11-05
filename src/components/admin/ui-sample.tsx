"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard, StatGroup } from "./stat-card";

/** Local gallery example: exercises native form semantics without a server action. */
export function AdminUiSample() {
  const [price, setPrice] = useState("229");
  const [message, setMessage] = useState("");
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
    </section>
  );
}
