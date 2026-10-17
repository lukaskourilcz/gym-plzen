import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { readDatabase } from "@/lib/db/read";
import {
  blockApplication,
  blockedSlot,
  blockTemplate,
  openingHours,
  reservation,
} from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
import { dateKeyInTimeZone, intervalsOverlap } from "@/lib/helpers/datetime";
import {
  blockApplySchema,
  blockPreviewSchema,
  blockTargetDates,
  blockTemplateSchema,
  buildBlockWindows,
  canonicalBlockSlots,
  slotFitsHours,
  type BlockApplyInput,
  type BlockPreviewInput,
  type BlockTemplateInput,
} from "@/lib/config/blocking";
import { reservationOverlaps, lockSchedule } from "./availability";

/** Deliberately no closures, fulfillment, providers or notification imports. */
export async function listBlockTemplates() {
  return db
    .select()
    .from(blockTemplate)
    .orderBy(asc(blockTemplate.createdAt), asc(blockTemplate.id));
}
export async function listBlockApplications(page = 1) {
  return db
    .select()
    .from(blockApplication)
    .orderBy(desc(blockApplication.createdAt), desc(blockApplication.id))
    .limit(21)
    .offset((page - 1) * 20);
}
export async function loadBlockingHours(executor: DatabaseExecutor = db) {
  return (
    await executor
      .select()
      .from(openingHours)
      .orderBy(asc(openingHours.dayOfWeek))
  ).map((row) => ({ ...row, isClosed: row.isClosed === 1 }));
}
export async function saveBlockTemplate(
  raw: BlockTemplateInput & { fingerprint?: string },
  adminId: string | null,
  now = new Date(),
) {
  const input = blockTemplateSchema.parse(raw);
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const slots = canonicalBlockSlots(input.slots);
    const hours = await loadBlockingHours(tx);
    if (!slots.every((slot) => slotFitsHours(slot, hours)))
      throw new ActionError(
        "Vybrané sloty už neodpovídají rozvrhu. Obnovte stránku a vyberte je znovu.",
      );
    const checked = await draftPreview(tx, { ...input, slots }, now);
    if (raw.fingerprint && checked.fingerprint !== raw.fingerprint)
      throw new ActionError(
        "Rozvrh, šablona nebo rezervace se změnily. Zkontrolujte nový náhled.",
      );
    if (!input.id) {
      const [row] = await tx
        .insert(blockTemplate)
        .values({
          name: input.name,
          slots,
          validFrom: input.validFrom,
          validTo: input.validTo,
          createdByAdminId: adminId,
        })
        .returning();
      return row!;
    }
    const [previous] = await tx
      .select()
      .from(blockTemplate)
      .where(eq(blockTemplate.id, input.id));
    if (
      !previous ||
      previous.updatedAt.toISOString() !== input.expectedUpdatedAt
    )
      throw new ActionError("Šablonu mezitím někdo upravil. Obnovte stránku.");
    const [row] = await tx
      .update(blockTemplate)
      .set({
        name: input.name,
        slots,
        validFrom: input.validFrom,
        validTo: input.validTo,
        updatedAt: new Date(),
      })
      .where(eq(blockTemplate.id, input.id))
      .returning();
    return row!;
  });
}

async function buildPreview(
  executor: DatabaseExecutor,
  input: BlockPreviewInput,
  now: Date,
  draft?: (typeof blockTemplate.$inferSelect)[],
) {
  let dates: string[];
  try {
    dates = blockTargetDates(input.target);
  } catch {
    throw new ActionError("Vyberte platné období, nejvýše 366 dní.");
  }
  const today = dateKeyInTimeZone(now);
  if (dates.some((date) => date < today))
    throw new ActionError("Blokovat lze jen dnešní a budoucí termíny.");
  if (dates.at(-1)! > `${Number(today.slice(0, 4)) + 2}-12-31`)
    throw new ActionError("Vyberte období nejvýše dva roky dopředu.");
  const templates =
    draft ??
    (await executor
      .select()
      .from(blockTemplate)
      .where(inArray(blockTemplate.id, [...new Set(input.templateIds)]))
      .orderBy(asc(blockTemplate.id)));
  if (templates.length !== new Set(input.templateIds).size)
    throw new ActionError("Některá šablona už neexistuje.");
  for (const template of templates) {
    if (!template.validFrom || !template.validTo)
      throw new ActionError(
        `Šablona „${template.name}“ nemá nastavené období. Nejprve ji upravte.`,
      );
    if (
      dates.some(
        (date) => date < template.validFrom! || date > template.validTo!,
      )
    )
      throw new ActionError(
        `Výběr je mimo období šablony „${template.name}“ (${template.validFrom} až ${template.validTo}).`,
      );
  }
  const hours = await loadBlockingHours(executor);
  const slots = canonicalBlockSlots(
    templates.flatMap((template) => template.slots),
  );
  if (!slots.every((slot) => slotFitsHours(slot, hours)))
    throw new ActionError(
      "Šablona neodpovídá aktuálnímu rozvrhu. Upravte její sloty a vytvořte nový náhled.",
    );
  let windows;
  try {
    windows = buildBlockWindows(dates, slots, now);
  } catch {
    throw new ActionError(
      "Některý čas při změně času v Praze neexistuje. Upravte výběr.",
    );
  }
  if (!windows.length)
    throw new ActionError(
      "Výběr neobsahuje žádné budoucí sloty vybraných šablon.",
    );
  const start = new Date(windows[0]!.startISO),
    end = new Date(windows.at(-1)!.endISO);
  const [bookings, blocks] = await Promise.all([
    executor
      .select({
        id: reservation.id,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        rescheduleStartsAt: reservation.rescheduleStartsAt,
        rescheduleEndsAt: reservation.rescheduleEndsAt,
      })
      .from(reservation)
      .where(
        and(
          reservationOverlaps(start, end),
          or(
            inArray(reservation.status, ["pending", "confirmed"]),
            eq(reservation.accessRevocationPending, true),
          ),
        ),
      )
      .orderBy(asc(reservation.id)),
    executor
      .select({
        id: blockedSlot.id,
        startsAt: blockedSlot.startsAt,
        endsAt: blockedSlot.endsAt,
      })
      .from(blockedSlot)
      .where(and(lt(blockedSlot.startsAt, end), gt(blockedSlot.endsAt, start)))
      .orderBy(asc(blockedSlot.id)),
  ]);
  const conflicts = windows.map((window) => {
    const a = new Date(window.startISO),
      b = new Date(window.endISO);
    return {
      startISO: window.startISO,
      reservationIds: bookings
        .filter(
          (booking) =>
            intervalsOverlap(a, b, booking.startsAt, booking.endsAt) ||
            (booking.rescheduleStartsAt &&
              booking.rescheduleEndsAt &&
              intervalsOverlap(
                a,
                b,
                booking.rescheduleStartsAt,
                booking.rescheduleEndsAt,
              )),
        )
        .map((row) => row.id),
      blockIds: blocks
        .filter((block) => intervalsOverlap(a, b, block.startsAt, block.endsAt))
        .map((row) => row.id),
    };
  });
  const snapshot = {
    templates: templates.map(({ id, name, slots, validFrom, validTo }) => ({
      id,
      name,
      slots,
      validFrom,
      validTo,
    })),
    windows,
  };
  // Include configuration and overlaps: a concurrent edit requires a fresh preview.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        snapshot,
        hours: hours.map(
          ({ dayOfWeek, openMinute, closeMinute, slotMinutes, isClosed }) => ({
            dayOfWeek,
            openMinute,
            closeMinute,
            slotMinutes,
            isClosed,
          }),
        ),
        revisions: templates.map((row) => row.updatedAt.toISOString()),
        conflicts,
      }),
    )
    .digest("hex");
  return { snapshot, fingerprint, conflicts, count: windows.length };
}
export type BlockPreview = Awaited<ReturnType<typeof buildPreview>>;
function draftPreview(
  executor: DatabaseExecutor,
  input: BlockTemplateInput,
  now: Date,
) {
  const id = input.id ?? "00000000-0000-4000-8000-000000000000";
  return buildPreview(
    executor,
    {
      templateIds: [id],
      target: {
        mode: "range",
        from:
          input.validFrom < dateKeyInTimeZone(now)
            ? dateKeyInTimeZone(now)
            : input.validFrom,
        to: input.validTo,
      },
    },
    now,
    [
      {
        id,
        name: input.name,
        slots: canonicalBlockSlots(input.slots),
        validFrom: input.validFrom,
        validTo: input.validTo,
        createdByAdminId: null,
        createdAt: new Date(0),
        updatedAt: new Date(input.expectedUpdatedAt ?? 0),
      },
    ],
  );
}
export async function previewBlockTemplate(
  raw: BlockTemplateInput,
  now = new Date(),
): Promise<BlockPreview> {
  const input = blockTemplateSchema.parse(raw);
  return readDatabase((tx) => draftPreview(tx, input, now));
}
export async function previewBlockApplication(
  raw: BlockPreviewInput,
  now = new Date(),
): Promise<BlockPreview> {
  const input = blockPreviewSchema.parse(raw);
  return readDatabase((tx) => buildPreview(tx, input, now));
}
function normalizedRequest(input: BlockPreviewInput): BlockPreviewInput {
  return {
    templateIds: [...new Set(input.templateIds)].sort(),
    target: { mode: "dates", dates: blockTargetDates(input.target) },
  };
}
export async function applyBlockTemplates(
  raw: BlockApplyInput,
  adminId: string | null,
  now = new Date(),
) {
  const input = blockApplySchema.parse(raw);
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const [existing] = await tx
      .select()
      .from(blockApplication)
      .where(eq(blockApplication.id, input.operationId));
    const request = normalizedRequest(input);
    if (existing) {
      if (
        JSON.stringify(normalizedRequest(existing.request)) !==
          JSON.stringify(request) ||
        existing.createdByAdminId !== adminId ||
        existing.fingerprint !== input.fingerprint
      )
        throw new ActionError(
          "Tato operace už byla použita pro jiný výběr. Vytvořte nový náhled.",
        );
      return { id: existing.id, count: existing.snapshot.windows.length };
    }
    const preview = await buildPreview(tx, input, now);
    if (preview.fingerprint !== input.fingerprint)
      throw new ActionError(
        "Rozvrh, šablony nebo obsazenost se změnily. Vytvořte nový náhled.",
      );
    await tx.insert(blockApplication).values({
      id: input.operationId,
      request,
      snapshot: preview.snapshot,
      fingerprint: preview.fingerprint,
      createdByAdminId: adminId,
    });
    // One atomic batch. Overlapping bookings are intentionally never touched.
    for (
      let offset = 0;
      offset < preview.snapshot.windows.length;
      offset += 500
    ) {
      await tx.insert(blockedSlot).values(
        preview.snapshot.windows.slice(offset, offset + 500).map((window) => ({
          applicationId: input.operationId,
          startsAt: new Date(window.startISO),
          endsAt: new Date(window.endISO),
          reason: "other" as const,
          note: `Blokace: ${preview.snapshot.templates.map((t) => t.name).join(", ")}`,
          createdByAdminId: adminId,
        })),
      );
    }
    return { id: input.operationId, count: preview.count };
  });
}
export async function cancelBlockApplication(id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const removed = await tx
      .delete(blockedSlot)
      .where(
        and(eq(blockedSlot.applicationId, id), gt(blockedSlot.startsAt, now)),
      )
      .returning({ id: blockedSlot.id });
    await tx
      .update(blockApplication)
      .set({ cancelledAt: now })
      .where(
        and(eq(blockApplication.id, id), isNull(blockApplication.cancelledAt)),
      );
    return { count: removed.length };
  });
}
