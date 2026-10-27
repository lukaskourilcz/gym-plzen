"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import { adjustCustomerCredit } from "@/lib/services/credit-admin";
const action = defineAction({
  schema: z
    .object({
      userId: z.string().uuid().optional(),
      email: z.string().email().optional(),
      name: z.string().max(120).optional(),
      mode: z.enum(["add", "remove", "set"]),
      amountCents: z.number().int().min(0).max(100000000),
      expectedBalance: z.number().int().nonnegative(),
      reason: z.string().trim().min(3).max(500),
      key: z.string().uuid(),
    })
    .refine((v) => v.userId || v.email, { message: "Vyberte zákazníka." }),
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await adjustCustomerCredit(input, admin.id);
    for (const path of ["/admin/credits", "/admin/members", "/account"])
      revalidatePath(path);
    if (input.userId) revalidatePath(`/admin/members/${input.userId}`);
  },
});
export async function adjustCreditAction(input: Parameters<typeof action>[0]) {
  return action(input);
}
