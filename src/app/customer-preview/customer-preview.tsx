"use client";
import { creditTender } from "@/lib/config/credits";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, RotateCcw, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { LoyaltyWidget } from "@/components/loyalty-widget";
import { BookingCalendar } from "@/app/rezervace/booking-calendar";
import { BookingDetailsForm } from "@/app/rezervace/udaje/booking-details-form";
import {
  CUSTOMER_PREVIEW_PATH as BASE,
  previewCalendar,
  previewSelection,
  type CustomerPreviewConfig,
} from "@/lib/helpers/customer-preview";
import { formatMoney } from "@/lib/helpers/format";
import { rewardPositions } from "@/lib/helpers/booking-selection";
import { deriveLoyaltyStatus } from "@/lib/helpers/loyalty-display";
import { withSelectedStarts } from "@/lib/helpers/booking-selection";
import type { BookingDetailsValues } from "@/lib/validations/booking";

import {
  PreviewReservationCard,
  type PreviewSlot,
  type PreviewReservation,
} from "./preview-reservation";

const INITIAL_PROFILE = {
  firstName: "Jana",
  lastName: "Ukázková",
  email: "jana@preview.example.test",
  phone: "+420 777 123 456",
};

interface PreviewOrder {
  slots: PreviewReservation[];
  totalCents: number;
  creditCents?: number;
  extraPeople: number;
  customer: typeof INITIAL_PROFILE;
}
const href = (screen: string) => `${BASE}?screen=${screen}`;

/** All mutable state lives in this tab's React tree; no action/API/provider writes. */
export function CustomerPreview({
  config: initial,
}: {
  config: CustomerPreviewConfig;
}) {
  const [config] = useState(initial);
  const params = useSearchParams();
  const screen = params.get("screen") ?? "calendar";
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [orders, setOrders] = useState<PreviewOrder[]>([]);
  const [pending, setPending] = useState<PreviewOrder | null>(null);
  const [message, setMessage] = useState("");
  const [creditCents, setCreditCents] = useState(0);
  const [pendingChange, setPendingChange] = useState<{
    id: string;
    startISO: string;
    priceCents: number;
    creditCents: number;
    cashCents: number;
  } | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const purchased = new Set(
    orders.flatMap((order) =>
      order.slots
        .filter((s) => s.status === "confirmed")
        .map((s) => s.startISO),
    ),
  );
  const load = useCallback(
    (month: string, date: string | null) =>
      previewCalendar(
        config,
        { month, date },
        new Set(
          orders.flatMap((o) =>
            o.slots
              .filter((s) => s.status === "confirmed")
              .map((s) => s.startISO),
          ),
        ),
      ),
    [config, orders],
  );
  const view = previewCalendar(
    config,
    { month: params.get("month"), date: params.get("date") ?? undefined },
    purchased,
  );
  const selected = previewSelection(config, params.getAll("start"), purchased);
  const loyalty = deriveLoyaltyStatus(
    6 +
      orders.flatMap((o) => o.slots).filter((s) => s.status === "confirmed")
        .length,
  );
  const rewards = rewardPositions(
    selected.length,
    loyalty.entriesUntilFree,
    loyalty.cadence,
  );
  const totalCents = selected.reduce(
    (sum, slot, index) => sum + (rewards[index] ? 0 : slot.priceCents),
    0,
  );
  const navigate = (next: string) => {
    window.history.pushState(null, "", href(next));
    setMessage("");
    window.scrollTo({ top: 0 });
  };
  const startPayment = (values: BookingDetailsValues, total: number) => {
    if (selected.length === 0) return;
    setPending({
      slots: selected.map((slot, index) => ({
        ...slot,
        id: crypto.randomUUID(),
        status: "confirmed",
        changed: false,
        priceCents: rewards[index] ? 0 : slot.priceCents,
        isReward: rewards[index],
      })),
      totalCents: total,
      creditCents: creditTender(total, creditCents, Boolean(values.useCredits)),
      extraPeople: Number(values.extraPeople),
      customer: {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
      },
    });
    navigate("payment");
  };
  const applyChange = (id: string, startISO: string, priceCents: number) => {
    const [next] = previewSelection(config, [startISO], purchased);
    if (!next) return;
    setOrders((all) =>
      all.map((order) => ({
        ...order,
        slots: order.slots.map((slot) =>
          slot.id === id
            ? {
                ...slot,
                startISO: next.startISO,
                label: next.label,
                durationMinutes: next.durationMinutes,
                changed: true,
                priceCents,
              }
            : slot,
        ),
      })),
    );
  };
  const pay = () => {
    if (pendingChange) {
      applyChange(
        pendingChange.id,
        pendingChange.startISO,
        pendingChange.priceCents,
      );
      setCreditCents((v) => v - pendingChange.creditCents);
      setPendingChange(null);
      navigate("account");
      setMessage(
        "Ukázkový doplatek byl ověřený a termín změněný. Žádná platba ani e-mail neodešly.",
      );
      return;
    }
    if (!pending) return;
    setCreditCents((v) => v - (pending.creditCents ?? 0));
    setOrders((previous) => [...previous, pending]);
    setPending(null);
    navigate("confirmation");
  };
  const reset = () => {
    setCreditCents(0);
    setPendingChange(null);
    setOrders([]);
    setPending(null);
    setProfile(INITIAL_PROFILE);
    setResetKey((k) => k + 1);
    navigate("calendar");
  };
  const removeSlot = (startISO: string) => {
    const remaining = selected.filter((slot) => slot.startISO !== startISO);
    const next = withSelectedStarts(
      new URLSearchParams(params.toString()),
      remaining.map((slot) => slot.startISO),
    );
    window.history.pushState(null, "", `${BASE}?${next}`);
    setMessage(
      "Termín byl odebrán z ukázkového výběru. Cena a bonus se přepočítaly.",
    );
  };
  const cancelReservation = (id: string) => {
    setOrders((all) =>
      all.map((order) => ({
        ...order,
        slots: order.slots.map((slot) =>
          slot.id === id ? { ...slot, status: "cancelled" } : slot,
        ),
      })),
    );
    setMessage(
      "Zrušen byl pouze vybraný ukázkový termín. Ostatní rezervace zůstávají platné. Žádný e-mail nebyl odeslán.",
    );
  };
  const changeReservation = (id: string, startISO: string) => {
    const [next] = previewSelection(config, [startISO], purchased);
    const original = orders
      .flatMap((o) => o.slots)
      .find((slot) => slot.id === id);
    if (!next || !original) return;
    const price = original.isReward ? 0 : next.priceCents;
    const delta = price - original.priceCents;
    if (delta > 0) {
      const used = creditTender(delta, creditCents, true);
      setPendingChange({
        id,
        startISO,
        priceCents: price,
        creditCents: used,
        cashCents: delta - used,
      });
      navigate("payment");
      return;
    }
    applyChange(id, startISO, price);
    setCreditCents((v) => v - delta);
    setMessage(
      delta < 0
        ? `Termín byl změněný a ${formatMoney(-delta)} se připsalo do ukázkových kreditů. Žádný e-mail nebyl odeslán.`
        : "Změněn byl pouze vybraný ukázkový termín. Cena a ostatní rezervace zůstávají stejné. Žádný e-mail nebyl odeslán.",
    );
  };
  const summary = (slots: PreviewSlot[], removable = false) => (
    <ul className="divide-y divide-border">
      {slots.map((slot) => (
        <li
          key={slot.startISO}
          className="flex flex-wrap justify-between gap-2 py-4"
        >
          <div className="min-w-0 flex-1">
            <span>{slot.label}</span>
            {slot.isReward ? (
              <p className="mt-1 text-sm font-bold text-success">
                Bonusový 10. vstup zdarma
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <strong>{formatMoney(slot.priceCents)}</strong>
            {removable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Odebrat termín ${slot.label}`}
                onClick={() => removeSlot(slot.startISO)}
              >
                Odebrat
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
  const titles: Record<string, string> = {
    calendar: "Vyber datum a čas",
    details: "Údaje a rekapitulace",
    payment: "Platba za rezervaci",
    confirmation: "Rezervace je potvrzená",
    account: `Ahoj, ${profile.firstName}`,
    home: "Tvůj čas. Tvůj prostor. Tvoje NAVI.",
    equipment: "Vybavení a prostor",
    faq: "Často kladené otázky",
  };
  return (
    <>
      <div className="border-b border-warning/40 bg-warning/15 px-4 py-3 text-sm">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
          <div className="flex min-w-0 basis-full items-start gap-3 lg:basis-auto lg:flex-1">
            <Eye className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <strong>Ukázkový zákaznický náhled</strong>
              <p className="mt-1">
                Všechny rezervace i platby jsou simulované. Nikomu nic neodejde.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Začít znovu
          </Button>
          {/* Full navigation also unloads the preview and any unsaved tab state. */}
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center font-bold underline"
          >
            Zpět do administrace
          </a>
        </div>
      </div>
      <SiteHeader
        brand={config.brand}
        previewBase={BASE}
        accountHref={href("account")}
        accountLabel="Můj účet"
      />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-24 pt-10 sm:pt-16">
          <Container>
            <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
              {screen === "account" ? "Můj účet" : "NAVI Private Gym"}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">
              {titles[screen] ?? titles.calendar}
            </h1>
            {message ? (
              <Notice tone="success" role="status" className="mt-5">
                {message}
              </Notice>
            ) : null}
            {screen === "calendar" || !titles[screen] ? (
              <>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                  Vyber jeden nebo více termínů a zaplať je jednou platbou. Ceny
                  a rozvrh odpovídají nastavení webu, obsazenost je ukázková.
                </p>
                <div className="mt-10">
                  <BookingCalendar
                    key={resetKey}
                    {...view}
                    selected={selected}
                    loyalty={loyalty}
                    simulation={{
                      calendarHref: `${BASE}?screen=calendar`.replace(
                        "?screen=calendar",
                        "",
                      ),
                      detailsHref: href("details"),
                      load,
                    }}
                  />
                </div>
              </>
            ) : null}
            {screen === "details" ? (
              selected.length ? (
                <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
                  <Card className="p-5 sm:p-7">
                    <h2 className="text-xl font-extrabold">Vybrané termíny</h2>
                    {summary(
                      selected.map((slot, index) => ({
                        ...slot,
                        priceCents: rewards[index] ? 0 : slot.priceCents,
                        isReward: rewards[index],
                      })),
                      true,
                    )}
                    <p className="border-t border-border pt-4 text-lg font-bold">
                      Celkem {formatMoney(totalCents)}
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      href={`${BASE}?${withSelectedStarts(
                        new URLSearchParams(),
                        selected.map((s) => s.startISO),
                      )}`}
                    >
                      Upravit výběr
                    </Button>
                  </Card>
                  <Card className="p-5 sm:p-7">
                    <h2 className="mb-6 text-xl font-extrabold">Tvoje údaje</h2>
                    <BookingDetailsForm
                      startsISO={selected.map((s) => s.startISO)}
                      availableCreditCents={creditCents}
                      totalCents={totalCents}
                      participantPricing={config.participants}
                      defaultValues={profile}
                      simulation={{ submit: startPayment }}
                    />
                  </Card>
                </div>
              ) : (
                <Notice className="mt-6">
                  Nejprve vyber termín v kalendáři.
                  <Button className="ml-3" onClick={() => navigate("calendar")}>
                    Vybrat termín
                  </Button>
                </Notice>
              )
            ) : null}
            {screen === "payment" ? (
              pendingChange ? (
                <Card className="mt-8 max-w-2xl p-6">
                  <Notice title="Simulace doplatku změny">
                    Původní ukázkový termín zatím platí. Comgate se neotevře a
                    žádné peníze se neposílají.
                  </Notice>
                  <p className="mt-5">
                    Použité kredity: {formatMoney(pendingChange.creditCents)}
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    Doplatek: {formatMoney(pendingChange.cashCents)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={pay}>Simulovat úspěšnou platbu</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingChange(null);
                        navigate("account");
                      }}
                    >
                      Ponechat původní termín
                    </Button>
                  </div>
                </Card>
              ) : pending ? (
                <Card className="mt-8 max-w-2xl p-6 sm:p-8">
                  <Notice title="Simulace platby">
                    Platební brána Comgate se neotevře. Tlačítkem níže pouze
                    dokončíš ukázkový průchod.
                  </Notice>
                  {summary(pending.slots)}
                  <p className="mt-4">
                    {pending.customer.firstName} {pending.customer.lastName} ·{" "}
                    {pending.customer.email}
                  </p>
                  {config.participants.enabled ? (
                    <p className="mt-2 text-sm">
                      Doprovod: {pending.extraPeople}
                    </p>
                  ) : null}
                  <p className="mt-5 text-2xl font-extrabold">
                    K platbě{" "}
                    {formatMoney(
                      pending.totalCents - (pending.creditCents ?? 0),
                    )}
                  </p>
                  {pending.creditCents ? (
                    <p className="mt-2 text-sm">
                      Úhrada kreditem {formatMoney(pending.creditCents)}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button onClick={pay}>Simulovat úspěšnou platbu</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPending(null);
                        navigate("calendar");
                        setMessage(
                          "Ukázková platba byla zrušena. Termíny zůstaly volné.",
                        );
                      }}
                    >
                      Zrušit platbu
                    </Button>
                  </div>
                </Card>
              ) : (
                <Notice className="mt-6">
                  Žádná ukázková platba není rozpracovaná.
                  <Button className="ml-3" onClick={() => navigate("calendar")}>
                    Vybrat termín
                  </Button>
                </Notice>
              )
            ) : null}
            {screen === "confirmation" ? (
              <Card className="mt-8 max-w-2xl p-7">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-10 text-success"
                />
                <h2 className="mt-4 text-xl font-extrabold">
                  {orders.length
                    ? "Ukázková platba proběhla úspěšně"
                    : "Zatím není dokončená žádná ukázková rezervace"}
                </h2>
                {orders.at(-1) ? summary(orders.at(-1)!.slots) : null}
                <p className="mt-4 text-muted-foreground">
                  Na ostrém webu zde zákazník uvidí potvrzení. V tomto náhledu
                  se nevytvořila skutečná rezervace ani vstupní kód a neodeslal
                  se žádný e-mail.
                </p>
                <Button className="mt-6" onClick={() => navigate("account")}>
                  Přejít do mého účtu
                </Button>
              </Card>
            ) : null}
            {screen === "account" ? (
              <section
                aria-label="Ukázkové kredity"
                className="mt-8 rounded-lg border border-border bg-card p-5"
              >
                <h2 className="text-xl font-bold">Tvoje kredity</h2>
                <p className="mt-2 text-3xl font-bold">
                  {formatMoney(creditCents)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ukázkový zůstatek lze použít při další simulované platbě.
                </p>
              </section>
            ) : null}
            {screen === "account" ? (
              <>
                <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
                  <LoyaltyWidget status={loyalty} />
                  <Card className="p-6">
                    <h2 className="text-xl font-extrabold">Osobní údaje</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Úpravy platí jen v tomto náhledu.
                    </p>
                    <form
                      className="mt-5 grid gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        setProfile({
                          ...profile,
                          firstName: String(data.get("firstName")),
                          lastName: String(data.get("lastName")),
                          phone: String(data.get("phone")),
                        });
                        setMessage(
                          "Ukázkový profil byl uložen pouze v tomto okně.",
                        );
                      }}
                    >
                      <label className="grid gap-2">
                        Jméno
                        <Input
                          name="firstName"
                          defaultValue={profile.firstName}
                          required
                          maxLength={60}
                        />
                      </label>
                      <label className="grid gap-2">
                        Příjmení
                        <Input
                          name="lastName"
                          defaultValue={profile.lastName}
                          required
                          maxLength={60}
                        />
                      </label>
                      <label className="grid gap-2">
                        Telefon
                        <Input
                          name="phone"
                          defaultValue={profile.phone}
                          required
                          type="tel"
                        />
                      </label>
                      <p className="break-all text-sm">
                        E-mail: {profile.email}
                      </p>
                      <Button type="submit">Uložit údaje</Button>
                    </form>
                  </Card>
                </div>
                <h2 className="mb-4 mt-10 text-2xl font-extrabold">
                  Nadcházející rezervace
                </h2>
                <p className="mb-5 text-sm text-muted-foreground">
                  Každý termín můžete spravovat samostatně. Změna nebo zrušení
                  jednoho vstupu neovlivní ostatní termíny z objednávky.
                </p>
                {orders.some((o) =>
                  o.slots.some((s) => s.status === "confirmed"),
                ) ? (
                  <div className="grid gap-4">
                    {orders
                      .flatMap((order) =>
                        order.slots
                          .filter((slot) => slot.status === "confirmed")
                          .map((slot) => ({ slot, order })),
                      )
                      .sort((a, b) =>
                        a.slot.startISO.localeCompare(b.slot.startISO),
                      )
                      .map(({ slot, order }) => (
                        <PreviewReservationCard
                          key={slot.id}
                          slot={slot}
                          extraPeople={order.extraPeople}
                          config={config}
                          purchased={purchased}
                          onCancel={cancelReservation}
                          onChange={changeReservation}
                        />
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Nemáš žádnou naplánovanou ukázkovou rezervaci.
                  </p>
                )}
                {orders.some((o) =>
                  o.slots.some((s) => s.status === "cancelled"),
                ) ? (
                  <>
                    <h2 className="mb-4 mt-10 text-2xl font-extrabold">
                      Historie rezervací
                    </h2>
                    <div className="grid gap-4">
                      {orders
                        .flatMap((order) =>
                          order.slots
                            .filter((slot) => slot.status === "cancelled")
                            .map((slot) => ({ slot, order })),
                        )
                        .map(({ slot, order }) => (
                          <PreviewReservationCard
                            key={slot.id}
                            slot={slot}
                            extraPeople={order.extraPeople}
                            config={config}
                            purchased={purchased}
                            onCancel={cancelReservation}
                            onChange={changeReservation}
                          />
                        ))}
                    </div>
                  </>
                ) : null}
                <Button className="mt-6" onClick={() => navigate("calendar")}>
                  Rezervovat další termín
                </Button>
              </>
            ) : null}
            {screen === "home" ? (
              <>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                  {config.subtitle}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button onClick={() => navigate("calendar")}>
                    Vybrat termín
                  </Button>
                  <Button variant="outline" onClick={() => navigate("account")}>
                    Můj účet
                  </Button>
                </div>
                <section id="jak-to-funguje" className="mt-16">
                  <h2 className="text-2xl font-extrabold">
                    Jak to u nás funguje
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    {[
                      "Vyber si termín",
                      "Potvrď údaje a zaplať",
                      "Před návštěvou dostaneš vstupní kód",
                    ].map((text, i) => (
                      <Card key={text} className="p-5">
                        <strong>
                          {i + 1}. {text}
                        </strong>
                      </Card>
                    ))}
                  </div>
                </section>
                <section id="cenik" className="mt-16">
                  <h2 className="text-2xl font-extrabold">Ceník a rezervace</h2>
                  <p className="mt-4">
                    Přesnou cenu každého bloku najdeš v kalendáři.
                  </p>
                  <Button className="mt-4" onClick={() => navigate("calendar")}>
                    Otevřít kalendář
                  </Button>
                </section>
                <section id="kontakt" className="mt-16">
                  <h2 className="text-2xl font-extrabold">Kontakt</h2>
                  <p className="mt-4">
                    V tomto náhledu používáš fiktivní zákaznický účet. Údaje
                    můžeš změnit v sekci Můj účet.
                  </p>
                </section>
              </>
            ) : null}
            {screen === "equipment" ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {config.equipment.map((zone) => (
                  <Card key={zone.title} className="p-6">
                    <h2 className="text-xl font-extrabold">{zone.title}</h2>
                    <p className="mt-4 whitespace-pre-line text-muted-foreground">
                      {zone.body}
                    </p>
                  </Card>
                ))}
              </div>
            ) : null}
            {screen === "faq" ? (
              <div className="mt-8 grid gap-3">
                {config.faq.map((item) => (
                  <details
                    className="rounded-lg border border-border bg-card p-5"
                    key={item.question}
                  >
                    <summary className="cursor-pointer font-bold">
                      {item.question}
                    </summary>
                    <p className="mt-4 whitespace-pre-line text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            ) : null}
          </Container>
        </Section>
      </main>
      <footer className="border-t border-border bg-ink px-5 py-8 text-center text-sm text-ink-foreground">
        {config.brand} · Ukázkový zákaznický účet · Změny zmizí po obnovení nebo
        zavření okna.
      </footer>
    </>
  );
}
