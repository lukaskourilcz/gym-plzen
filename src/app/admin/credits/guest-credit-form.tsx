"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CreditEditor } from "@/components/admin/credit-editor";
export function GuestCreditForm() {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-sm">
        Kredit pro neregistrovaného zákazníka
        <Input
          type="email"
          placeholder="E-mail zákazníka"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? (
        <CreditEditor email={email} label="Přidat kredit hostovi" />
      ) : null}
    </div>
  );
}
