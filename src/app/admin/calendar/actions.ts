"use server";

import { z } from "zod";
import { getSessionUser, isAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import { listCalendarEntries } from "@/lib/services/availability";

const load = defineAction({
  schema: z
    .object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    })
    .refine(
      ({ start, end }) =>
        Date.parse(end) > Date.parse(start) &&
        Date.parse(end) - Date.parse(start) <= 93 * 86_400_000,
      "Neplatný rozsah kalendáře.",
    ),
  authorize: async () => {
    const user = await getSessionUser();
    if (!isAdmin(user)) throw new Error("Unauthorized");
    return user!;
  },
  handler: async ({ start, end }, user) => {
    if (user.isDemo) return [];
    const { reservations, blocks } = await listCalendarEntries(
      new Date(start),
      new Date(end),
    );
    const labels = {
      pending: "Čeká na platbu",
      confirmed: "Potvrzeno",
      completed: "Dokončeno",
      no_show: "Nedostavil se",
      cancelled: "Zrušeno",
    };
    return [
      ...reservations
        .filter((r) => r.status !== "cancelled")
        .map((r) => ({
          id: r.id,
          title: `${labels[r.status]}: ${r.contactName ?? "Rezervace"}`,
          start: r.startsAt.toISOString(),
          end: r.endsAt.toISOString(),
          backgroundColor:
            r.status === "pending" ? "var(--warning)" : "var(--success)",
          borderColor: "transparent",
          textColor: "var(--success-foreground)",
        })),
      ...blocks.map((b) => ({
        id: b.id,
        title: b.note ?? "Blok",
        start: b.startsAt.toISOString(),
        end: b.endsAt.toISOString(),
        backgroundColor: "var(--muted)",
        borderColor: "var(--muted-foreground)",
        textColor: "var(--foreground)",
      })),
    ];
  },
});

export async function loadCalendarAction(input: {
  start: string;
  end: string;
}) {
  return load(input);
}
