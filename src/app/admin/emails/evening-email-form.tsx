"use client";
import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveEveningEmailStartAction } from "./actions";

export function EveningEmailForm({ minute }: { minute: number }) {
  const [time, setTime] = useState(
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Večerní upozornění</CardTitle>
        <CardDescription>
          Rozhoduje začátek rezervace v časovém pásmu Praha, od zvoleného času
          včetně. Dřívější zprávy se znovu neposílají.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveEveningEmailStartAction({ time });
              setMessage(result.ok ? "Čas odesílání uložen." : result.error);
            });
          }}
        >
          <Label htmlFor="evening-from">
            Od jakého času posílat vstupní kód s večerním upozorněním
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="evening-from"
              type="time"
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="max-w-36"
            />
            <Button disabled={pending} type="submit">
              {pending ? "Ukládám…" : "Uložit čas"}
            </Button>
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
