import { z } from "zod";
import { idSchema, uuidSchema, optionalPhone } from "./common";

export const updateMemberSchema = z.object({
  userId: idSchema,
  phone: optionalPhone,
  notifyByWhatsapp: z.boolean(),
  notifyBySms: z.boolean(),
  marketingConsent: z.boolean(),
});

export const updateMemberNoteSchema = z.object({
  userId: uuidSchema,
  note: z.string().max(2000, "Poznámka může mít nejvýše 2000 znaků."),
});
export type UpdateMemberNoteValues = z.infer<typeof updateMemberNoteSchema>;

/** Grant or revoke the administrator role for one member. */
export const setMemberRoleSchema = z.object({
  userId: idSchema,
  role: z.enum(["member", "admin"]),
});

export type UpdateMemberValues = z.infer<typeof updateMemberSchema>;
export type SetMemberRoleValues = z.infer<typeof setMemberRoleSchema>;
