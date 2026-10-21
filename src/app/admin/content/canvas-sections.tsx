"use client";

import { BrandMark } from "@/components/site/brand";
import { Check, Clock3, MapPin } from "lucide-react";
import { FAQ_NUMBERS } from "@/lib/content/faq";
import { getContentAsset } from "@/lib/content/editor-visuals";
import { parseRulesBody } from "@/lib/content/rules";
import {
  Text,
  Photo,
  Source,
  Cta,
  Backdrop,
  useCanvas,
} from "./canvas-controls";

const heading = "text-3xl font-extrabold leading-tight @2xl:text-4xl";
const eyebrow =
  "text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground";
const padding = "p-5 @2xl:p-8 @4xl:p-12";

function Quote() {
  return (
    <blockquote className="flex items-start gap-5 py-6 text-ink-foreground/80">
      <BrandMark decorative className="mt-1 size-12 shrink-0 text-gold" />
      <div>
        <Text field="home.cta.quote" as="p" className="leading-7" />
        <Text
          field="home.cta.quoteAuthor"
          as="p"
          className="mt-2 text-sm font-bold text-gold"
        />
      </div>
    </blockquote>
  );
}
function Hero() {
  const { preview, assets, onEditAsset } = useCanvas();
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4 text-primary">
        <BrandMark decorative className="size-8 shrink-0" />
        <Text
          field="brand.name"
          className="font-bold uppercase tracking-wider"
        />
      </div>
      <Backdrop hero>
        <div className="grid gap-10 @4xl:grid-cols-2">
          <div>
            <h2 className="whitespace-pre-line text-4xl font-extrabold leading-[1.1] @2xl:text-5xl">
              <Text field="home.hero.title" />{" "}
              <Text field="home.hero.titleAccent" className="text-gold" />
            </h2>
            <Text
              field="home.hero.subtitle"
              as="p"
              className="mt-7 text-lg leading-8 text-ink-foreground/75"
            />
            <div className="mt-7 grid gap-5 text-sm @xl:grid-cols-2">
              <div className="flex gap-3">
                <MapPin
                  aria-hidden="true"
                  className="size-6 shrink-0 text-gold"
                />
                <div>
                  <Text
                    field="home.hero.addressLabel"
                    as="p"
                    className="text-xs font-bold uppercase"
                  />
                  <Text
                    field="contact.address"
                    as="p"
                    className="mt-1 font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Clock3
                  aria-hidden="true"
                  className="size-6 shrink-0 text-gold"
                />
                <div>
                  <Text
                    field="home.hero.hoursLabel"
                    as="p"
                    className="text-xs font-bold uppercase"
                  />
                  <div className="mt-1 font-bold">
                    <Source kind="hours">{preview.hours}</Source>
                  </div>
                  <Text field="home.hero.hoursNote" />
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta field="home.hero.primaryCta" />
              <div className="rounded-sm border border-white/45 px-5 py-3 font-bold">
                <Text field="home.hero.secondaryCta" />
              </div>
            </div>
            <p className="canvas-meta mt-2 text-ink-foreground/75">
              Tato tlačítka se na webu zobrazují na mobilu.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
            <p className="text-xl font-bold">Vyberte datum a čas</p>
            <p className="canvas-meta my-3 text-muted-foreground">
              Kalendář se načítá z aktuálního rozvrhu a obsazenosti.
            </p>
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-1 text-center text-sm"
            >
              {["PO", "ÚT", "ST", "ČT", "PÁ", "SO", "NE"].map((d) => (
                <span key={d} className="py-2 text-xs font-bold">
                  {d}
                </span>
              ))}
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  className={`rounded-sm py-2 ${i === 16 ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="mt-5 text-sm">
              <Source>{preview.price}</Source> ·{" "}
              <Source kind="hours">Rozvrh a délka bloků</Source>
            </div>
            <p className="canvas-meta mt-3 text-muted-foreground">
              Ukázka rozložení, bez výběru skutečného termínu.
            </p>
          </div>
        </div>
      </Backdrop>
      <details className="canvas-meta border-t border-border p-5">
        <summary className="cursor-pointer font-semibold">
          Mobilní fotografie a další popisky
        </summary>
        <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
          <Photo
            assetKey="branding.zone_1_url"
            alt="Úvodní fotografie na mobilu"
          />
          <div className="grid content-start gap-4">
            <Text field="home.hero.badge" as="p" />
            <p>
              Popis úvodní fotografie: {assets["branding.hero_image_alt"]}{" "}
              <button
                type="button"
                className="canvas-pencil"
                aria-label="Upravit: Popis úvodní fotografie pro čtečky"
                onClick={() =>
                  onEditAsset(getContentAsset("branding.hero_image_alt")!)
                }
              >
                ✎
              </button>
            </p>
          </div>
        </div>
      </details>
    </>
  );
}
function Facts() {
  const { preview } = useCanvas();
  return (
    <div className="grid @xl:grid-cols-2 @4xl:grid-cols-4">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="flex min-h-28 flex-col items-center justify-center border border-border px-4 py-5 text-center"
        >
          <div className="text-lg font-extrabold">
            {n === 3 ? (
              <Source kind="hours">{preview.hours}</Source>
            ) : (
              <Text field={`home.facts.${n}.title`} />
            )}
          </div>
          <Text
            field={`home.facts.${n}.body`}
            as="p"
            className="mt-1 text-sm text-muted-foreground"
          />
        </div>
      ))}
    </div>
  );
}
function Steps() {
  return (
    <Backdrop>
      <h2
        className={`flex items-center justify-center gap-4 text-center uppercase ${heading}`}
      >
        <BrandMark decorative className="size-10 shrink-0 text-gold" />
        <Text field="home.about.title" />
      </h2>
      <ol className="mt-6 grid gap-px overflow-hidden rounded-lg bg-border @2xl:grid-cols-2 @4xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
          <li
            key={n}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] content-start gap-x-4 bg-card px-5 py-6 text-card-foreground"
          >
            <span
              aria-hidden="true"
              className="row-span-2 grid size-11 place-items-center rounded-sm bg-gold font-extrabold text-gold-foreground"
            >
              {String(n).padStart(2, "0")}
            </span>
            <Text
              field={`home.about.step${n}.title`}
              as="h3"
              className="pt-1 text-lg uppercase leading-tight text-accent-foreground"
            />
            <Text
              field={`home.about.step${n}.body`}
              as="p"
              className="mt-2 text-sm leading-6 text-muted-foreground"
            />
          </li>
        ))}
      </ol>
    </Backdrop>
  );
}
function Pricing() {
  const { preview } = useCanvas();
  return (
    <>
      <Backdrop>
        <div className="grid gap-10 @3xl:grid-cols-2">
          <div>
            <Text
              field="home.pricing.eyebrow"
              as="p"
              className={`${eyebrow} text-gold`}
            />
            <h2 className={`mt-4 whitespace-pre-line ${heading}`}>
              <Text field="home.pricing.title" />
              <br />
              <Text field="home.pricing.titleAccent" className="text-gold" />
            </h2>
            <ul className="mt-8 border-t border-white/15">
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className="flex items-start gap-4 border-b border-white/15 py-3.5 text-sm"
                >
                  <Check
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-gold"
                  />
                  <Text field={`home.pricing.feature${n}`} />
                </li>
              ))}
              <li className="border-b border-white/15 py-3.5 text-sm">
                <Source kind="loyalty">
                  Každý {preview.freeEntryEvery}. vstup zdarma pro registrované
                </Source>
              </li>
            </ul>
          </div>
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
            <Text
              field="home.pricing.cardLabel"
              as="p"
              className="border-b border-border px-5 py-5 text-center text-lg font-extrabold uppercase tracking-wider text-accent-foreground"
            />
            <div className="flex flex-1 flex-col justify-center border-b border-border px-5 py-10 text-center">
              <div className="flex flex-wrap items-baseline justify-center gap-3">
                <Text
                  field="home.pricing.pricePrefix"
                  className="font-bold text-muted-foreground"
                />
                <span className="text-5xl font-extrabold leading-none text-gold">
                  <Source>{preview.price}</Source>
                </span>
                <Text
                  field="home.pricing.duration"
                  className="text-sm font-bold text-muted-foreground"
                />
              </div>
              <Text
                field="home.pricing.priceScope"
                as="p"
                className="mt-4 text-sm font-semibold"
              />
              {preview.isPromo ? (
                <Text
                  field="home.pricing.promoNote"
                  as="p"
                  className="mt-4 text-sm font-bold text-accent-foreground"
                />
              ) : (
                <details className="canvas-meta mt-4 text-muted-foreground">
                  <summary className="cursor-pointer">
                    Text při aktivní akci
                  </summary>
                  <Text field="home.pricing.promoNote" as="p" />
                </details>
              )}
            </div>
            <div className="px-5 py-7 text-center">
              <Cta field="home.pricing.button" />
            </div>
          </div>
        </div>
      </Backdrop>
      <div className={`bg-ink text-ink-foreground ${padding}`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Text field="home.cta.title" as="h2" className="text-3xl" />
          <Cta field="home.cta.button" gold />
        </div>
        <Quote />
      </div>
    </>
  );
}
function Gallery() {
  return (
    <div className={padding}>
      <Text
        field="home.gallery.eyebrow"
        as="p"
        className={`${eyebrow} text-center`}
      />
      <Text
        field="home.gallery.title"
        as="h2"
        className={`mt-3 text-center ${heading}`}
      />
      <div className="mt-8 grid gap-4 @3xl:grid-cols-[1.35fr_1fr]">
        <Photo
          assetKey="branding.gallery_1_url"
          altField="home.gallery.mainImageAlt"
          className="aspect-[4/3] @3xl:aspect-auto"
        />
        <div className="grid grid-cols-2 gap-3">
          {[
            [3, "home.gallery.image3"],
            [4, "home.gallery.image4"],
            [5, "equipment.zone5.title"],
            [2, "home.gallery.image2"],
          ].map(([n, field]) => (
            <Photo
              key={n}
              assetKey={
                n === 5 ? "branding.zone_5_url" : `branding.gallery_${n}_url`
              }
              altField={String(field)}
              className="aspect-square"
            />
          ))}
        </div>
      </div>
      <div className="mt-7 border-t border-border pt-7">
        <Cta field="home.gallery.button" />
      </div>
    </div>
  );
}
function Equipment() {
  return (
    <div className={padding}>
      <Text field="equipment.eyebrow" as="p" className={eyebrow} />
      <Text field="equipment.title" as="h2" className={`mt-3 ${heading}`} />
      <Photo
        src="/images/photos/hero.webp"
        altField="equipment.imageAlt"
        className="mt-8 aspect-[16/7]"
      />
      <Text field="equipment.zonesTitle" as="h2" className="mt-12 text-3xl" />
      <Text
        field="equipment.zonesIntro"
        as="p"
        className="mt-4 max-w-3xl leading-7 text-muted-foreground"
      />
      <ul className="mt-8 grid gap-4 @4xl:grid-cols-2">
        {[1, 2, 3, 6, 5, 4].map((n, i) => (
          <li
            key={n}
            className={`grid overflow-hidden rounded-lg @xl:grid-cols-2 ${i % 2 === 0 ? "bg-ink text-ink-foreground" : "bg-sage-soft text-sage-foreground"}`}
          >
            <div className="p-6">
              <Text
                field={`equipment.zone${n}.title`}
                as="h3"
                className="text-xl uppercase"
              />
              <Text
                field={`equipment.zone${n}.body`}
                as="p"
                className="mt-4 text-sm leading-6 opacity-85"
              />
            </div>
            <Photo
              assetKey={`branding.zone_${n}_url`}
              alt={`Zóna ${n}`}
              className="aspect-[4/3] @xl:aspect-auto @xl:min-h-52"
              imageClassName={n === 3 ? "origin-[72%_25%] scale-[1.55]" : ""}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
function Faq() {
  return (
    <div className={padding}>
      <Text field="faq.title" as="h2" className={heading} />
      <div className="mt-10 divide-y divide-border border-y border-border">
        {FAQ_NUMBERS.map((n) => (
          <div key={n} className="py-5">
            <div className="flex items-start gap-4">
              <BrandMark
                decorative
                className="mt-1 size-7 shrink-0 text-accent-foreground"
              />
              <Text field={`faq.${n}.question`} as="h3" className="text-lg" />
            </div>
            <Text
              field={`faq.${n}.answer`}
              as="p"
              className="max-w-2xl pl-11 pt-3 leading-7 text-muted-foreground"
            />
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-secondary p-6">
        <Text field="faq.cta" as="p" className="font-bold" />
        <Cta field="faq.ctaButton" />
      </div>
    </div>
  );
}
function Contact() {
  const { preview } = useCanvas();
  return (
    <>
      <div className="relative min-h-[460px] bg-accent p-5 @2xl:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(30deg, transparent 46%, white 47%, white 51%, transparent 52%), linear-gradient(100deg, transparent 46%, white 47%, white 51%, transparent 52%)",
            backgroundSize: "100px 140px",
          }}
        />
        <div className="relative max-w-sm border border-border bg-card p-5 shadow-md">
          <Text
            field="home.contact.mapHeading"
            as="p"
            className="text-sm font-extrabold uppercase text-accent-foreground"
          />
          <Text field="contact.address" as="p" className="mt-2 font-bold" />
          <Text
            field="home.contact.hours"
            as="p"
            className="mt-3 text-sm text-muted-foreground"
          >
            {(preview.texts["home.contact.hours"] ?? "").replace(
              "{hours}",
              preview.hours,
            )}
          </Text>
          <div className="canvas-meta mt-2">
            <Source kind="hours">Upravit otevírací dobu</Source>
          </div>
        </div>
        <div className="relative mt-20">
          <Cta field="home.contact.mapsButton" />
        </div>
        <p className="canvas-meta relative mt-3 text-muted-foreground">
          Schéma mapy. Skutečná mapa je na veřejném webu.
        </p>
      </div>
      <div className={`bg-ink text-ink-foreground ${padding}`}>
        <Text field="home.contact.title" as="h2" className="text-2xl" />
        <div className="mt-5 grid gap-5 @2xl:grid-cols-2">
          <div className="grid content-start gap-3">
            <Text field="contact.phone" />
            <Text field="contact.phoneSecondary" />
            <Text field="contact.email" />
          </div>
          <div className="grid content-start gap-3">
            <Text field="contact.facebook" />
            <Text field="contact.instagram" />
          </div>
        </div>
      </div>
    </>
  );
}
function Newsletter() {
  return (
    <>
      <div
        className={`grid gap-10 bg-ink text-ink-foreground @3xl:grid-cols-2 ${padding}`}
      >
        <Quote />
        <div className="border-t border-white/15 pt-8 @3xl:border-l @3xl:border-t-0 @3xl:pl-8 @3xl:pt-0">
          <Text
            field="home.newsletter.title"
            as="h2"
            className="text-2xl @2xl:text-3xl"
          />
          <Text
            field="home.newsletter.body"
            as="p"
            className="mt-3 text-sm text-ink-foreground/75"
          />
          <div className="mt-5 grid gap-3 @xl:grid-cols-[1fr_auto]">
            <div className="min-w-0 rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <Text field="home.newsletter.placeholder" />
            </div>
            <Cta field="home.newsletter.button" gold />
          </div>
          <div className="mt-3 text-xs leading-5 text-ink-foreground/75">
            <Text field="home.newsletter.consent" />{" "}
            <Text field="home.newsletter.privacyLink" className="underline" />
          </div>
        </div>
      </div>
      <div
        className={`border-t border-white/15 bg-ink text-ink-foreground ${padding}`}
      >
        <Text field="brand.name" as="p" className="text-lg font-bold" />
        <Text
          field="footer.description"
          as="p"
          className="mt-3 max-w-xl text-sm text-ink-foreground/75"
        />
      </div>
    </>
  );
}
function Rules() {
  const { preview, onEdit } = useCanvas();
  const body = preview.texts["home.rules.body"] ?? "";
  const sections = parseRulesBody(body);
  return (
    <div className={padding}>
      <Text field="home.rules.title" as="h2" className={heading} />
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className="canvas-photo-control"
          aria-label="Upravit: Text provozního řádu"
          onClick={() =>
            onEdit({ key: "home.rules.body", label: "Text provozního řádu" })
          }
        >
          ✎ Upravit text provozního řádu
        </button>
      </div>
      <div data-content-field="home.rules.body" className="mt-6 grid gap-8">
        {sections.length ? (
          sections.map((s) => (
            <div key={s.number}>
              <h3 className="border-b border-border pb-3 text-xl">
                {s.number}. {s.title}
              </h3>
              <div className="mt-4 grid gap-4">
                {s.clauses.map((c) => (
                  <p key={c.number} className="text-sm leading-7">
                    <strong>{c.number}.</strong> {c.text}
                  </p>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="whitespace-pre-wrap leading-7">{body}</p>
        )}
      </div>
    </div>
  );
}
export function CanvasSection({ id }: { id: string }) {
  switch (id) {
    case "hero":
      return <Hero />;
    case "facts":
      return <Facts />;
    case "steps":
      return <Steps />;
    case "pricing":
      return <Pricing />;
    case "gallery":
      return <Gallery />;
    case "equipment":
      return <Equipment />;
    case "faq":
      return <Faq />;
    case "contact":
      return <Contact />;
    case "newsletter":
      return <Newsletter />;
    case "rules":
      return <Rules />;
    default:
      return null;
  }
}
