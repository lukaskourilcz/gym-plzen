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

const recover = defineAction({
  schema: z.object({ id: z.string().uuid() }),
  authorize: assertAdmin,
  handler: async ({ id }) => {
    const { recoverFailedChange } =
      await import("@/lib/services/priced-rescheduling");
    await recoverFailedChange(id);
    revalidatePath("/admin/credits");
  },
});
export async function recoverCreditChangeAction(input: { id: string }) {
  return recover(input);
}
const confirmRefund = defineAction({
  schema: z.object({
    id: z.string().uuid(),
    reference: z.string().trim().min(3).max(200),
  }),
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const { confirmChangeRefund } = await import("@/lib/services/credit-admin");
    await confirmChangeRefund(input.id, input.reference, admin.id);
    revalidatePath("/admin/credits");
  },
});
export async function confirmCreditRefundAction(input: {
  id: string;
  reference: string;
}) {
  return confirmRefund(input);
}
