"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { formDateTimeToInstant } from "@/lib/helpers/datetime";
import { activity, vouchers } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
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
      // The form field is Prague wall-clock time, not the server's zone.
      validFrom: input.validFrom
        ? formDateTimeToInstant(input.validFrom)
        : null,
      validUntil: input.validUntil
        ? formDateTimeToInstant(input.validUntil)
        : null,
      createdByAdminId: admin.id,
    });
    const discount =
      created.kind === "percentage"
        ? `${created.value} %`
        : formatMoney(created.value);
    const validity = [
      created.validFrom ? `od ${formatDateTime(created.validFrom)}` : null,
      created.validUntil ? `do ${formatDateTime(created.validUntil)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    await activity.record({
      action: "voucher.created",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Voucher ${created.code} (sleva ${discount}${created.maxRedemptions ? `, max. ${created.maxRedemptions} použití` : ""}) vytvořen${validity ? `, platí ${validity}` : ", bez časového omezení"}.`,
      context: { voucherId: created.id },
    });
    revalidatePath("/admin/vouchers");
    return created;
  },
});

const setVoucherActiveImpl = defineAction({
  schema: setVoucherActiveSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const updated = await vouchers.setVoucherActive(input.id, input.isActive);
    await activity.record({
      action: input.isActive ? "voucher.activated" : "voucher.deactivated",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Voucher ${updated.code} ${input.isActive ? "aktivován" : "deaktivován"}.`,
      context: { voucherId: updated.id },
    });
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
