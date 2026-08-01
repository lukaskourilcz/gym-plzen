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

/** Password-reset request must not reveal whether an account exists. */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordUpdateSchema = z
  .object({
    password: z.string().min(8, "Heslo musí mít alespoň 8 znaků.").max(200),
    passwordConfirmation: z.string().min(1, "Heslo zadejte ještě jednou."),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Hesla se neshodují.",
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type PasswordResetRequestValues = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordUpdateValues = z.infer<typeof passwordUpdateSchema>;
