import { and, asc, eq, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { pricingPeriod } from "@/lib/db/schema";
import type { PricingPeriod } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";

/** All configured periods, chronologically, for the administration. */
export async function listPricingPeriods(): Promise<PricingPeriod[]> {
  return db.select().from(pricingPeriod).orderBy(asc(pricingPeriod.startsAt));
}

/** The one period that contains the booking moment. Overlap is DB-forbidden. */
export async function getActivePricingPeriod(
  at: Date = new Date(),
): Promise<PricingPeriod | null> {
  const [row] = await db
    .select()
    .from(pricingPeriod)
    .where(and(lte(pricingPeriod.startsAt, at), gt(pricingPeriod.endsAt, at)))
    .limit(1);
  return row ?? null;
}

export interface SavePricingPeriodInput {
  id?: string;
  name: string;
  priceCents: number;
  startsAt: Date;
  /** Exclusive end instant. */
  endsAt: Date;
  adminId?: string | null;
}

/** Insert or update one price period. The exclusion constraint is the arbiter. */
export async function savePricingPeriod(
  input: SavePricingPeriodInput,
): Promise<PricingPeriod> {
  const now = new Date();
  try {
    const [saved] = input.id
      ? await db
          .update(pricingPeriod)
          .set({
            name: input.name.trim(),
            priceCents: input.priceCents,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            updatedAt: now,
          })
          .where(eq(pricingPeriod.id, input.id))
          .returning()
      : await db
          .insert(pricingPeriod)
          .values({
            name: input.name.trim(),
            priceCents: input.priceCents,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            createdByAdminId: input.adminId ?? null,
            updatedAt: now,
          })
          .returning();

    if (!saved) throw new ActionError("Cenové období nebylo nalezeno.");
    return saved;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "23P01") {
      throw new ActionError(
        "Toto cenové období se překrývá s jiným. Upravte prosím data tak, aby se období nepřekrývala.",
      );
    }
    throw error;
  }
}

export async function deletePricingPeriod(id: string): Promise<void> {
  const [deleted] = await db
    .delete(pricingPeriod)
    .where(eq(pricingPeriod.id, id))
    .returning({ id: pricingPeriod.id });
  if (!deleted) throw new ActionError("Cenové období nebylo nalezeno.");
}
