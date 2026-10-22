"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction, ActionError } from "@/lib/helpers/action";
import {
  INSTAGRAM_ENABLED_KEY,
  instagramEnabledSchema,
  instagramVisibilitySchema,
  instagramProblemText,
} from "@/lib/config/instagram";
import { cms } from "@/lib/services";
import {
  disconnectInstagram,
  getInstagramAdminState,
  setInstagramHidden,
  syncInstagram,
} from "@/lib/services/instagram";
import { invalidateInstagram } from "@/lib/services/instagram-cache";

const enabled = defineAction({
  schema: instagramEnabledSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await cms.setSetting(INSTAGRAM_ENABLED_KEY, input.enabled, admin.id);
    invalidateInstagram();
    return getInstagramAdminState();
  },
});
const visibility = defineAction({
  schema: instagramVisibilitySchema,
  authorize: assertAdmin,
  handler: async (input) => {
    await setInstagramHidden(input.id, input.hidden);
    invalidateInstagram();
    return getInstagramAdminState();
  },
});
const refresh = defineAction({
  schema: z.object({}),
  authorize: assertAdmin,
  handler: async () => {
    const result = await syncInstagram({ force: true });
    invalidateInstagram();
    if (result.problem)
      throw new ActionError(instagramProblemText(result.problem));
    return getInstagramAdminState();
  },
});
const disconnect = defineAction({
  schema: z.object({}),
  authorize: assertAdmin,
  handler: async () => {
    await disconnectInstagram();
    invalidateInstagram();
    return getInstagramAdminState();
  },
});
export async function saveInstagramEnabledAction(input: { enabled: boolean }) {
  return enabled(input);
}
export async function saveInstagramVisibilityAction(input: {
  id: string;
  hidden: boolean;
}) {
  return visibility(input);
}
export async function refreshInstagramAction() {
  return refresh({});
}
export async function disconnectInstagramAction() {
  return disconnect({});
}
