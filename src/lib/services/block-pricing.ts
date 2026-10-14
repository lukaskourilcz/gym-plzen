import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { openingHours, siteSetting } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
import {
  BLOCK_PRICING_KEY,
  blockPriceSchema,
  isBlockPriceAligned,
  parseBlockPrices,
  type BlockPrice,
} from "@/lib/config/block-pricing";
import {
  PARTICIPANT_PRICING_KEY,
  PARTICIPANTS_ENABLED_KEY,
  parseParticipantsEnabled,
  type ParticipantOptions,
  parseParticipantPricing,
  participantPricingSchema,
  type ParticipantPricing,
} from "@/lib/config/participants";
import { lockSchedule } from "./availability";
import { getSetting, setSetting } from "./cms";

export async function listBlockPrices(
  executor: DatabaseExecutor = db,
): Promise<BlockPrice[]> {
  const [row] = await executor
    .select({ value: siteSetting.value })
    .from(siteSetting)
    .where(eq(siteSetting.key, BLOCK_PRICING_KEY));
  return parseBlockPrices(row?.value);
}
export async function saveBlockPrice(
  input: Omit<BlockPrice, "id"> & {
    id?: string;
    applyToMatchingDays?: boolean;
  },
  adminId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const hours = await tx.select().from(openingHours);
    const { applyToMatchingDays, ...range } = input;
    const rule = blockPriceSchema.parse({
      ...range,
      id: input.id ?? randomUUID(),
    });
    const day = hours.find((row) => row.dayOfWeek === rule.dayOfWeek);
    if (!day || !isBlockPriceAligned(rule, day))
      throw new ActionError(
        "Rozvrh se změnil. Vyberte znovu první a poslední blok.",
      );
    const saved = await listBlockPrices(tx);
    if (input.id && !saved.some((r) => r.id === input.id))
      throw new ActionError("Cenový rozsah nebyl nalezen.");
    const days =
      applyToMatchingDays && !input.id
        ? hours.filter(
            (h) =>
              !h.isClosed &&
              h.openMinute === day.openMinute &&
              h.closeMinute === day.closeMinute &&
              h.slotMinutes === day.slotMinutes,
          )
        : [day];
    const replacements = days.map((h) => ({
      ...rule,
      dayOfWeek: h.dayOfWeek,
      id: h.dayOfWeek === rule.dayOfWeek ? rule.id : randomUUID(),
    }));
    if (
      replacements.some((next) =>
        saved.some(
          (r) =>
            r.id !== next.id &&
            r.dayOfWeek === next.dayOfWeek &&
            r.startMinute < next.endMinute &&
            r.endMinute > next.startMinute,
        ),
      )
    )
      throw new ActionError(
        "V některém z vybraných dní je už nastavená jiná cena. Upravte existující rozsah nebo ukládejte dny jednotlivě.",
      );
    const ids = new Set(replacements.map((next) => next.id));
    const value = [
      ...saved.filter((r) => !ids.has(r.id)),
      ...replacements,
    ].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
    );
    const values = { value, updatedByAdminId: adminId, updatedAt: new Date() };
    await tx
      .insert(siteSetting)
      .values({ key: BLOCK_PRICING_KEY, ...values })
      .onConflictDoUpdate({ target: siteSetting.key, set: values });
  });
}
export async function deleteBlockPrice(
  id: string,
  adminId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const saved = await listBlockPrices(tx);
    if (!saved.some((r) => r.id === id))
      throw new ActionError("Cenový rozsah nebyl nalezen.");
    await tx
      .update(siteSetting)
      .set({
        value: saved.filter((r) => r.id !== id),
        updatedByAdminId: adminId,
        updatedAt: new Date(),
      })
      .where(eq(siteSetting.key, BLOCK_PRICING_KEY));
  });
}
export async function getParticipantsEnabled(): Promise<boolean> {
  return parseParticipantsEnabled(await getSetting(PARTICIPANTS_ENABLED_KEY));
}
export async function getParticipantPricing(): Promise<ParticipantOptions> {
  const [pricing, enabled] = await Promise.all([
    getSetting(PARTICIPANT_PRICING_KEY),
    getParticipantsEnabled(),
  ]);
  return { ...parseParticipantPricing(pricing), enabled };
}
export async function setParticipantsEnabled(
  enabled: boolean,
  adminId: string,
): Promise<void> {
  // A separate setting preserves the prepared price, even when both forms save concurrently.
  await setSetting(PARTICIPANTS_ENABLED_KEY, enabled, adminId);
}
export async function saveParticipantPricing(
  input: ParticipantPricing,
  adminId: string,
): Promise<void> {
  await setSetting(
    PARTICIPANT_PRICING_KEY,
    participantPricingSchema.parse(input),
    adminId,
  );
}
