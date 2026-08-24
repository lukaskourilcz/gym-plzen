import { z } from "zod";
import { uuidSchema } from "./common";

const optionalDateTime = z
  .string()
  .optional()
  .refine(
    (value) => !value || !Number.isNaN(Date.parse(value)),
    "Zadejte platné datum a čas.",
  );

export const createVoucherSchema = z
  .object({
    code: z
      .string()
      .max(64, "Kód je příliš dlouhý.")
      .regex(/^[A-Za-z0-9_-]*$/, "Použijte jen písmena, čísla, _ nebo -.")
      .optional(),
    kind: z.enum(["percentage", "fixed_amount"]),
    value: z
      .number({ invalid_type_error: "Zadejte hodnotu slevy." })
      .positive("Sleva musí být vyšší než nula."),
    maxRedemptions: z
      .number({ invalid_type_error: "Zadejte celé číslo." })
      .int("Limit musí být celé číslo.")
      .positive("Limit musí být vyšší než nula.")
      .optional(),
    validFrom: optionalDateTime,
    validUntil: optionalDateTime,
  })
  .superRefine((value, context) => {
    if (
      value.kind === "percentage" &&
      (!Number.isInteger(value.value) || value.value > 100)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Procentuální sleva musí být celé číslo od 1 do 100.",
      });
    }
    if (
      value.validFrom &&
      value.validUntil &&
      new Date(value.validUntil) <= new Date(value.validFrom)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "Konec platnosti musí být později než začátek.",
      });
    }
  });

export const setVoucherActiveSchema = z.object({
  id: uuidSchema,
  isActive: z.boolean(),
});

export type CreateVoucherValues = z.infer<typeof createVoucherSchema>;
export type SetVoucherActiveValues = z.infer<typeof setVoucherActiveSchema>;
