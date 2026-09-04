import { z } from "zod";
import { idSchema, optionalPhone, optionalText } from "./common";

export const updateMemberSchema = z.object({
  userId: idSchema,
  phone: optionalPhone,
  notifyByWhatsapp: z.boolean(),
  notifyBySms: z.boolean(),
  marketingConsent: z.boolean(),
  note: optionalText(2000),
});

/** Grant or revoke the administrator role for one member. */
export const setMemberRoleSchema = z.object({
  userId: idSchema,
  role: z.enum(["member", "admin"]),
});

export type UpdateMemberValues = z.infer<typeof updateMemberSchema>;
export type SetMemberRoleValues = z.infer<typeof setMemberRoleSchema>;
