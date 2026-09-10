import { z } from "zod";
import { toE164 } from "@/lib/helpers/phone";

const name = z
  .string()
  .max(60, "Použijte nejvýše 60 znaků.")
  .refine((value) => value.trim().length > 0, "Vyplňte toto pole.");
export const profileSchema = z
  .object({
    firstName: name,
    lastName: name,
    phone: z
      .string()
      .max(40)
      .refine(
        (value) => !value.trim() || toE164(value) !== null,
        "Zadejte platné telefonní číslo.",
      ),
    notifyByWhatsapp: z.boolean(),
    avatarSource: z.enum(["initials", "google"]),
  })
  .refine((value) => !value.notifyByWhatsapp || Boolean(value.phone.trim()), {
    path: ["phone"],
    message: "Pro WhatsApp vyplňte telefonní číslo.",
  });
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadejte současné heslo.").max(200),
    password: z.string().min(8, "Heslo musí mít alespoň 8 znaků.").max(200),
    passwordConfirmation: z
      .string()
      .min(1, "Heslo zadejte ještě jednou.")
      .max(200),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Hesla se neshodují.",
  })
  .refine((value) => value.password !== value.currentPassword, {
    path: ["password"],
    message: "Nové heslo musí být jiné než současné.",
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
