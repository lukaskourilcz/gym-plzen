import { z } from "zod";
import { emailSchema } from "./common";

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

export type PasswordResetRequestValues = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordUpdateValues = z.infer<typeof passwordUpdateSchema>;
