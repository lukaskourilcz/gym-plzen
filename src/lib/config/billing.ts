/**
 * Billing profile and payment-document rules.
 *
 * A payment document names a real business, so every fact on it is sourced,
 * never invented. The defaults below are the issuer the client's own VOP names
 * (see DEFAULT_BILLING_PROFILE); the administration can correct them, and what
 * an administrator saves wins. If a required field is ever blanked, no document
 * is issued at all : a document with a made-up IČO would be worse than none.
 *
 * Pure module: no database, no I/O, so the rules stay unit-testable.
 */

export const BILLING_PROFILE_SETTING_KEY = "billing.profile";
export const BILLING_ENABLED_SETTING_KEY = "billing.send_documents";

/** What the operator fills in under Nastavení → Fakturační údaje. */
export interface BillingProfile {
  /** Trade name of the operator, as registered. */
  legalName: string;
  street: string;
  city: string;
  zip: string;
  /** Company number. Required : it is what identifies the issuer. */
  ico: string;
  /** Tax number. Only meaningful for a VAT payer. */
  dic: string;
  /**
   * 0 means the operator is not a VAT payer: the document then shows a single
   * total and says so, with no VAT breakdown invented for it.
   */
  vatRatePercent: number;
  /** Optional, printed under the supplier block when filled in. */
  bankAccount: string;
  /** Optional registry sentence, e.g. the trade-licence register wording. */
  registryNote: string;
}

export const EMPTY_BILLING_PROFILE: BillingProfile = {
  legalName: "",
  street: "",
  city: "",
  zip: "",
  ico: "",
  dic: "",
  vatRatePercent: 0,
  bankAccount: "",
  registryNote: "",
};

/**
 * The issuer as the client's own VOP states it.
 *
 * These are not guesses: article 1.2 of `lib/content/terms.ts` names, in the
 * client's supplied legal text, who receives payments for reservations and who
 * issues the accounting and tax documents for them : "Renáta Janoušková, IČO:
 * 29619998, sídlo: Úhlavská 546/2, 326 00, Plzeň - Doudlevce". Article 4.5
 * repeats it. The gym is run by two operators, but only one of them is the
 * Poskytovatel, and it is the Poskytovatel who belongs on the document.
 *
 * The VOP states no DIČ and never mentions DPH, so the rate stays 0 : a
 * document then shows one total and says "Neplátce DPH" rather than inventing
 * a tax breakdown. If that is wrong, the operator sets the rate and the DIČ in
 * Nastavení and every document issued from then on carries them.
 */
export const DEFAULT_BILLING_PROFILE: BillingProfile = {
  legalName: "Renáta Janoušková",
  street: "Úhlavská 546/2",
  city: "Plzeň - Doudlevce",
  zip: "326 00",
  ico: "29619998",
  dic: "",
  vatRatePercent: 0,
  bankAccount: "",
  registryNote: "",
};

export const MAX_VAT_RATE_PERCENT = 100;

/**
 * Normalise whatever is stored, so a half-written setting cannot crash a
 * render. Nothing stored at all means nobody has edited the profile yet, so
 * the issuer named in the VOP applies; an explicitly blanked field stays
 * blank, because that is an edit.
 */
export function parseBillingProfile(value: unknown): BillingProfile {
  if (value === null || value === undefined)
    return { ...DEFAULT_BILLING_PROFILE };
  const raw = (value ?? {}) as Partial<Record<keyof BillingProfile, unknown>>;
  const text = (key: keyof BillingProfile) =>
    typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
  const rate = Number(raw.vatRatePercent);
  return {
    legalName: text("legalName"),
    street: text("street"),
    city: text("city"),
    zip: text("zip"),
    ico: text("ico"),
    dic: text("dic"),
    vatRatePercent:
      Number.isFinite(rate) && rate >= 0 && rate <= MAX_VAT_RATE_PERCENT
        ? Math.round(rate)
        : 0,
    bankAccount: text("bankAccount"),
    registryNote: text("registryNote"),
  };
}

/**
 * Which required fields are still empty. The administration shows these, and
 * the issuing service refuses to produce a document while any remain.
 *
 * A VAT payer additionally needs a DIČ: a document showing VAT without the tax
 * number it was charged under is not a valid tax document.
 */
export function missingBillingFields(profile: BillingProfile): string[] {
  const missing: string[] = [];
  if (!profile.legalName) missing.push("Název firmy");
  if (!profile.street) missing.push("Ulice a číslo");
  if (!profile.city) missing.push("Město");
  if (!profile.zip) missing.push("PSČ");
  if (!profile.ico) missing.push("IČO");
  if (profile.vatRatePercent > 0 && !profile.dic) missing.push("DIČ");
  return missing;
}

export function isBillingProfileComplete(profile: BillingProfile): boolean {
  return missingBillingFields(profile).length === 0;
}

/**
 * Split a paid amount into base and VAT.
 *
 * The customer paid a gross price, so VAT is computed downwards from it
 * ("shora"), which is what keeps the printed total equal to the amount that
 * actually left their account. A non-payer gets no split at all.
 */
export interface AmountBreakdown {
  totalCents: number;
  baseCents: number;
  vatCents: number;
  vatRatePercent: number;
  /** False when the operator is not a VAT payer: print a plain total. */
  hasVat: boolean;
}

export function breakDownAmount(
  totalCents: number,
  vatRatePercent: number,
): AmountBreakdown {
  if (vatRatePercent <= 0) {
    return {
      totalCents,
      baseCents: totalCents,
      vatCents: 0,
      vatRatePercent: 0,
      hasVat: false,
    };
  }
  const baseCents = Math.round(totalCents / (1 + vatRatePercent / 100));
  return {
    totalCents,
    baseCents,
    // Derived by subtraction so base + VAT always equals what was paid.
    vatCents: totalCents - baseCents,
    vatRatePercent,
    hasVat: true,
  };
}

/**
 * Document number: the year plus a zero-padded counter that restarts each
 * year, e.g. `2026-0001`. Sequential and gapless per year, which is what an
 * accountant expects to see.
 */
export function formatDocumentNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

/** The counter key a year's sequence is stored under. */
export function documentCounterKey(year: number): string {
  return `invoice:${year}`;
}
