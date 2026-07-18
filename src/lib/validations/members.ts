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

export type UpdateMemberValues = z.infer<typeof updateMemberSchema>;
