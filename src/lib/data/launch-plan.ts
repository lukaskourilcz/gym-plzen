/**
 * Launch plan — the checklist toward going live, rendered with a progress bar
 * in the admin under "Plán". Update `status` as items are completed; the bar
 * recomputes automatically.
 *
 * status: "done" (counts 100%), "in_progress" (counts 50%), "todo" (0%),
 *         "blocked" (0%, waiting on the operator — see NEEDED.md).
 */

export type PlanStatus = "done" | "in_progress" | "todo" | "blocked";

export interface PlanItem {
  title: string;
  status: PlanStatus;
  note?: string;
}

export interface PlanPhase {
  title: string;
  items: PlanItem[];
}

export const LAUNCH_PLAN: PlanPhase[] = [
  {
    title: "Architektura a backend",
    items: [
      { title: "Vrstvená architektura (routes → services → db/integrace)", status: "done" },
      { title: "Databázové schéma (Drizzle) + migrace", status: "done" },
      { title: "Ochrana proti překrytí rezervací (DB constraint)", status: "done" },
      { title: "Přihlášení Better Auth (e-mail + Google/Apple/Microsoft)", status: "done" },
      { title: "Znovupoužitelné helpery (http retry, akce, formuláře…)", status: "done" },
    ],
  },
  {
    title: "Administrace (redakční systém)",
    items: [
      { title: "Editor obsahu webu (texty)", status: "done" },
      { title: "Rezervace — ruční vytvoření/zrušení", status: "done" },
      { title: "Kalendář (FullCalendar) + bloky pro úklid", status: "done" },
      { title: "Otevírací doba a doba na sprchu (konfigurovatelné)", status: "done" },
      { title: "Členové a jejich profily", status: "done" },
      { title: "Vstupné a věrnostní přehled", status: "done" },
      { title: "Doručené zprávy, kniha vstupů, upozornění", status: "done" },
      { title: "Statistiky (sessions/den, nejčastější časy, měsíce)", status: "done" },
      { title: "Nastavení a branding — logo, podmínky (PDF), šablony zpráv", status: "done" },
      { title: "Nahrávání souborů do úložiště (logo, PDF, fotky)", status: "done", note: "Potřebuje Supabase Storage" },
      { title: "Zavření dne s rezervacemi → e-mail/WhatsApp členům", status: "done" },
      { title: "Nastavitelné zavřené dny + doba na sprchu", status: "done" },
      { title: "Ukázková data (DummyJSON) pro prázdné obrazovky", status: "done" },
    ],
  },
  {
    title: "Veřejný web",
    items: [
      { title: "Design systém (Tailwind + shadcn styl, téma)", status: "done" },
      { title: "Úvodní stránka (hero, jak to funguje, ceník, galerie, řád, kontakt)", status: "done" },
      { title: "Stránka rezervací s výběrem hodinových slotů", status: "done" },
      { title: "Kalendář (FullCalendar) v administraci", status: "done" },
      { title: "Skutečné fotky a finální texty", status: "blocked", note: "Dodá klient; vkládá se v administraci" },
      { title: "Logo a branding", status: "blocked", note: "Dodá klient" },
    ],
  },
  {
    title: "Rezervace, platby a kódy",
    items: [
      { title: "Generování hodinových slotů 05–21", status: "done" },
      { title: "Živý kalendář v reálném čase (Supabase Realtime)", status: "in_progress", note: "Kód hotov (RealtimeRefresher); zapnout Realtime + RLS v Supabase" },
      { title: "Checkout přes Stripe (jednorázový vstup 290 Kč)", status: "done", note: "Tlačítko slotu → Stripe / vstup zdarma; potvrdí webhook. Potřebuje klíče." },
      { title: "Věrnost — každý 10. vstup zdarma (počítadlo)", status: "done" },
      { title: "Vydání a doručení kódu (e-mail + WhatsApp)", status: "done", note: "Kód se pošle po platbě; potřebuje klíče" },
    ],
  },
  {
    title: "Spolehlivost a dohled",
    items: [
      { title: "Pipeline platba → kód → doručení + retry", status: "done" },
      { title: "Upozornění na selhání do WhatsApp skupiny", status: "done" },
      { title: "Cron watchdog + synchronizace knihy vstupů", status: "done" },
      { title: "Sentry (chyby) — instrumentace", status: "done", note: "Potřebuje DSN" },
      { title: "UptimeRobot / heartbeat monitoru", status: "todo" },
    ],
  },
  {
    title: "Napojení služeb (potřebuje tebe — viz NEEDED.md)",
    items: [
      { title: "Supabase — databáze + migrace + seed", status: "in_progress", note: "Projekt založen (eu-west-3); doplnit heslo DB + secret key, spustit migrace" },
      { title: "Stripe — klíče + webhook", status: "blocked" },
      { title: "Resend — doména + API klíč", status: "blocked" },
      { title: "WhatsApp Business — účet + šablona access_code", status: "blocked" },
      { title: "Nuki — token + zámek + webhook", status: "blocked" },
      { title: "Doména + DNS", status: "blocked" },
    ],
  },
  {
    title: "Nasazení",
    items: [
      { title: "Vercel projekt + env proměnné", status: "blocked", note: "Import repa, doplnit env" },
      { title: "Bezpečnostní hlavičky (HSTS, X-Frame-Options…)", status: "done" },
      { title: "SEO (metadata, OG) + Google Analytics", status: "in_progress", note: "Metadata hotová, GA doplnit ID" },
      { title: "E2E testy workflow a formulářů (Playwright)", status: "done", note: "28/28 prochází" },
      { title: "Ostrý provoz + zaškolení", status: "todo" },
    ],
  },
  {
    title: "2. fáze — mobilní aplikace",
    items: [
      { title: "React Native aplikace (iOS + Android)", status: "todo", note: "Po spuštění webu" },
    ],
  },
];

/** Weight per status for the progress calculation. */
const WEIGHT: Record<PlanStatus, number> = {
  done: 1,
  in_progress: 0.5,
  todo: 0,
  blocked: 0,
};

export interface PlanProgress {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  todo: number;
  percent: number;
}

/** Overall completion percentage across all phases. */
export function computeProgress(plan: PlanPhase[] = LAUNCH_PLAN): PlanProgress {
  const items = plan.flatMap((p) => p.items);
  const total = items.length;
  const weighted = items.reduce((sum, i) => sum + WEIGHT[i.status], 0);
  const count = (s: PlanStatus) => items.filter((i) => i.status === s).length;
  return {
    total,
    done: count("done"),
    inProgress: count("in_progress"),
    blocked: count("blocked"),
    todo: count("todo"),
    percent: total === 0 ? 0 : Math.round((weighted / total) * 100),
  };
}
