import { z } from "zod";
import { uuidSchema } from "./common";
export const addParticipantsSchema = z.object({
  reservationId: uuidSchema,
  useCredits: z.boolean().optional(),
  toCount: z.number().int().min(1).max(2),
  quotedCents: z.number().int().min(0).max(2_000_000),
});
export type AddParticipantsValues = z.infer<typeof addParticipantsSchema>;
