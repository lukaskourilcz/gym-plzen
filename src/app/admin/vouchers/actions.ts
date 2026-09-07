"use server";

import { adminDateTimeToInstant } from "@/lib/helpers/datetime";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { vouchers } from "@/lib/services";
import {
  createVoucherSchema,
  setVoucherActiveSchema,
  type CreateVoucherValues,
  type SetVoucherActiveValues,
} from "@/lib/validations/vouchers";

const createVoucherImpl = defineAction({
  schema: createVoucherSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const created = await vouchers.createVoucher({
      code: input.code,
      kind: input.kind,
      value:
        input.kind === "percentage"
          ? input.value
          : Math.round(input.value * 100),
      maxRedemptions: input.maxRedemptions,
      validFrom: input.validFrom
        ? adminDateTimeToInstant(input.validFrom)
        : null,
      validUntil: input.validUntil
        ? adminDateTimeToInstant(input.validUntil)
        : null,
      createdByAdminId: admin.id,
    });
    revalidatePath("/admin/vouchers");
    return created;
  },
});

const setVoucherActiveImpl = defineAction({
  schema: setVoucherActiveSchema,
  authorize: assertAdmin,
  handler: async (input) => {
    await vouchers.setVoucherActive(input.id, input.isActive);
    revalidatePath("/admin/vouchers");
  },
});

export async function createVoucherAction(
  input: CreateVoucherValues,
): Promise<Result<unknown>> {
  return createVoucherImpl(input);
}

export async function setVoucherActiveAction(
  input: SetVoucherActiveValues,
): Promise<Result<unknown>> {
  return setVoucherActiveImpl(input);
}
