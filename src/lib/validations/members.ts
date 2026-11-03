import { z } from "zod";
import { idSchema, uuidSchema, optionalPhone } from "./common";
import { emailSchema } from "./common";

export const memberContactSnapshotSchema = z.object({
  email: z.string().max(1000).nullable(),
  fullName: z.string().max(1000).nullable(),
  firstName: z.string().max(1000).nullable(),
  lastName: z.string().max(1000).nullable(),
  phone: z.string().max(1000).nullable(),
});
export const updateMemberContactSchema = z.object({
  userId: uuidSchema,
  fullName: z
    .string()
    .max(120, "Jméno může mít nejvýše 120 znaků.")
    .refine((s) => s.trim().length > 0, "Vyplňte jméno zákazníka."),
  email: z
    .string()
    .max(254)
    .refine(
      (s) => emailSchema.safeParse(s.trim()).success,
      "Zadejte platný e-mail.",
    ),
  phone: optionalPhone,
  expected: memberContactSnapshotSchema,
});
export type UpdateMemberContactValues = z.infer<
  typeof updateMemberContactSchema
>;

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
