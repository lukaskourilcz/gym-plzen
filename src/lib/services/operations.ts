import {
  DEFAULT_OPERATIONS,
  OPERATIONS_SETTING_KEY,
  operationsSchema,
  type Operations,
} from "@/lib/config/operations";
import { ActionError } from "@/lib/helpers/action";
import { isComgateConfigured } from "@/lib/integrations/comgate";
import { isNukiConfigured } from "@/lib/integrations/nuki";
import { getSetting, setSetting } from "./cms";

export async function getOperations(): Promise<Operations> {
  const parsed = operationsSchema.safeParse(
    await getSetting(OPERATIONS_SETTING_KEY),
  );
  return parsed.success ? parsed.data : DEFAULT_OPERATIONS;
}

export async function saveOperations(input: Operations, adminId: string) {
  if (input.paymentsEnabled && !isComgateConfigured())
    throw new ActionError(
      "Nejdříve doplňte přístupy Comgate. Do té doby nelze dokončit placenou rezervaci.",
    );
  if (input.accessCodesEnabled && !isNukiConfigured())
    throw new ActionError("Nejdříve nastavte a otestujte zámek Nuki.");
  await setSetting(OPERATIONS_SETTING_KEY, input, adminId);
}
