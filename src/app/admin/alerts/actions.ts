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
  note: z.string().trim().min(1, "Napište, jak byl incident vyřešen.").max(500),
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
  input: z.infer<typeof resolveAlertSchema>,
): Promise<Result<null>> {
  return resolveImpl(input);
}
