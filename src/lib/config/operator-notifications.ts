import { z } from "zod";

/**
 * Informational e-mails to the people who run the gym: a booking arrived, a
 * customer moved their time, something needs attention. They are a running
 * commentary on the business, not a channel a customer ever sees, so every
 * event is opt-in and the addresses are the operator's own.
 *
 * The event keys mirror `services/activity.ts`, so an entry in the history and
 * the e-mail about it read as the same event.
 */

export const OPERATOR_NOTIFICATIONS_SETTING_KEY = "notifications.operator";

export const OPERATOR_EVENT_IDS = [
  "reservationConfirmed",
  "reservationRescheduled",
  "reservationCancelled",
  "memberRegistered",
  "systemAlert",
] as const;

export type OperatorEventId = (typeof OPERATOR_EVENT_IDS)[number];

export interface OperatorEventDefinition {
  id: OperatorEventId;
  /** Subject of the e-mail and label of the checkbox. */
  label: string;
  /** What exactly triggers it, in the administration's words. */
  description: string;
  defaultEnabled: boolean;
}

export const OPERATOR_EVENT_DEFINITIONS: readonly OperatorEventDefinition[] = [
  {
    id: "reservationConfirmed",
    label: "Nová rezervace",
    description:
      "Potvrzená rezervace zákazníka: zaplacená, na voucher i věrnostní vstup zdarma.",
    defaultEnabled: true,
  },
  {
    id: "reservationRescheduled",
    label: "Změna termínu",
    description: "Zákazník si přesunul svou rezervaci na jiný čas.",
    defaultEnabled: true,
  },
  {
    id: "reservationCancelled",
    label: "Zrušená rezervace",
    description:
      "Potvrzená rezervace byla zrušena v administraci nebo uzavřením termínů.",
    defaultEnabled: false,
  },
  {
    id: "memberRegistered",
    label: "Nová registrace",
    description:
      "Návštěvník dokončil registraci potvrzením e-mailu nebo přihlášením přes Google.",
    defaultEnabled: false,
  },
  {
    id: "systemAlert",
    label: "Provozní problém",
    description:
      "Provozní potíže ze sekce Upozornění: nedoručený vstupní kód, platba k vrácení, zaseknutá rezervace.",
    defaultEnabled: true,
  },
];

export function operatorEventDefinition(
  id: OperatorEventId,
): OperatorEventDefinition {
  return OPERATOR_EVENT_DEFINITIONS.find((event) => event.id === id)!;
}

/** At most this many addresses, so a typo cannot turn into a mailing list. */
export const MAX_OPERATOR_RECIPIENTS = 5;
export const MAX_OPERATOR_RECIPIENTS_LENGTH = 320;

/**
 * Addresses as the operator types them: separated by commas, semicolons or
 * new lines. Kept as one string in the setting (the schema stays
 * transform-free and is reused by the form), split here for sending.
 */
export function parseRecipients(value: string): string[] {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const address = part.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(address);
  }
  return recipients;
}

const address = z.string().email();

const recipientsSchema = z
  .string()
  .trim()
  .max(
    MAX_OPERATOR_RECIPIENTS_LENGTH,
    `Adresy mohou mít nejvýše ${MAX_OPERATOR_RECIPIENTS_LENGTH} znaků.`,
  )
  .refine(
    (value) =>
      parseRecipients(value).every((one) => address.safeParse(one).success),
    "Zadejte platné e-mailové adresy oddělené čárkou.",
  )
  .refine(
    (value) => parseRecipients(value).length <= MAX_OPERATOR_RECIPIENTS,
    `Zadejte nejvýše ${MAX_OPERATOR_RECIPIENTS} adres.`,
  );

const eventsSchema = z.object(
  Object.fromEntries(
    OPERATOR_EVENT_IDS.map((id) => [id, z.boolean()]),
  ) as Record<OperatorEventId, z.ZodBoolean>,
);

export const operatorNotificationsSchema = z.object({
  recipients: recipientsSchema,
  events: eventsSchema,
});

export type OperatorNotifications = z.infer<typeof operatorNotificationsSchema>;

export const DEFAULT_OPERATOR_NOTIFICATIONS: OperatorNotifications = {
  recipients: "",
  events: Object.fromEntries(
    OPERATOR_EVENT_DEFINITIONS.map((event) => [event.id, event.defaultEnabled]),
  ) as OperatorNotifications["events"],
};
