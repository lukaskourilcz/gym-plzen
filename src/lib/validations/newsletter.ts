import { z } from "zod";
import { emailSchema } from "./common";

export const newsletterSignupSchema = z.object({
  email: emailSchema.max(254),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(200).optional(),
});

export type NewsletterSignupValues = z.infer<typeof newsletterSignupSchema>;
