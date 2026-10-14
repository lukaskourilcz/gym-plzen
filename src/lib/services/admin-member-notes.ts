import { and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

/** One bounded lookup per admin page, after requireAdmin; no name matching. */
export async function getMemberNotes(userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: profiles.id, note: profiles.note })
    .from(profiles)
    .where(and(inArray(profiles.id, ids), isNotNull(profiles.note)));
  return new Map(
    rows.filter((row) => row.note?.trim()).map((row) => [row.id, row.note!]),
  );
}
