"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { uuidSchema } from "@/lib/validations/common";
import { alerts } from "@/lib/services";

const resolveAlertSchema = z.object({
  id: uuidSchema,
  note: z.string().trim().max(500).optional().default(""),
});

/**
 * Close an alert the operator has dealt with (a refund made in Comgate, a
 * lock checked by hand). A later occurrence of the same problem alerts again.
 */
const resolveImpl = defineAction({
  schema: resolveAlertSchema,
  authorize: assertAdmin,
  handler: async ({ id, note }) => {
    await alerts.resolveAlertById(id, note);
    revalidatePath("/admin/alerts");
    revalidatePath("/admin");
    return null;
  },
});

export async function resolveAlertAction(
  input: z.input<typeof resolveAlertSchema>,
): Promise<Result<null>> {
  return resolveImpl(input);
}

const resolveAllSchema = z.object({
  before: z.string().datetime(),
  note: z.string().trim().max(500).optional().default(""),
});
const resolveAllImpl = defineAction({
  schema: resolveAllSchema,
  authorize: assertAdmin,
  handler: async ({ before, note }) => {
    await alerts.resolveAllOpenAlerts(
      new Date(Math.min(Date.parse(before), Date.now())),
      note,
    );
    revalidatePath("/admin/alerts");
    revalidatePath("/admin");
    return null;
  },
});

export async function resolveAllAlertsAction(
  input: z.input<typeof resolveAllSchema>,
): Promise<Result<null>> {
  return resolveAllImpl(input);
}
