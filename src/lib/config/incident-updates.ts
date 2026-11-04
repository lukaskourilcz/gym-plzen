import { z } from "zod";

const incidentUpdateSchema = z.object({
  at: z.string().datetime(),
  kind: z.enum(["opened", "repeated", "recovered", "closed", "manual"]),
  message: z.string().max(500),
});

export type IncidentUpdate = z.infer<typeof incidentUpdateSchema>;
export type IncidentResolution = Omit<IncidentUpdate, "at" | "kind"> & {
  kind: "recovered" | "closed" | "manual";
};

export const INCIDENT_UPDATE_LABELS: Record<IncidentUpdate["kind"], string> = {
  opened: "Zachyceno",
  repeated: "Stále otevřeno",
  recovered: "Automaticky vyřešeno",
  closed: "Automaticky uzavřeno",
  manual: "Uzavřeno správcem",
};

export function incidentUpdates(context: unknown): IncidentUpdate[] {
  if (
    !context ||
    typeof context !== "object" ||
    !("incidentUpdates" in context)
  )
    return [];
  const values = context.incidentUpdates;
  if (!Array.isArray(values)) return [];
  return values.slice(-13).flatMap((value) => {
    const result = incidentUpdateSchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}
