import { z } from "zod";
import { emailSchema } from "./common";

/** Sign-in: email + password. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Zadejte heslo."),
});

/** Sign-up: adds a required name and a minimum password length. */
export const signUpSchema = z.object({
  name: z.string().min(1, "Zadejte jméno.").max(120),
  email: emailSchema,
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
