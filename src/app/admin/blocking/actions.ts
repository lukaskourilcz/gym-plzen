"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import {
  blockApplySchema,
  blockPreviewSchema,
  blockTemplateSchema,
  type BlockApplyInput,
  type BlockPreviewInput,
  type BlockTemplateInput,
} from "@/lib/config/blocking";
import {
  applyBlockTemplates,
  cancelBlockApplication,
  previewBlockApplication,
  saveBlockTemplate,
  previewBlockTemplate,
} from "@/lib/services/blocking";

function refresh() {
  for (const path of [
    "/admin/blocking",
    "/admin/calendar",
    "/admin/schedule",
    "/rezervace",
  ])
    revalidatePath(path);
}
const save = defineAction({
  schema: blockTemplateSchema.and(
    z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  ),
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const template = await saveBlockTemplate(input, admin.id);
    refresh();
    return template;
  },
});
const preview = defineAction({
  schema: blockPreviewSchema,
  authorize: assertAdmin,
  handler: (input) => previewBlockApplication(input),
});
const templatePreview = defineAction({
  schema: blockTemplateSchema,
  authorize: assertAdmin,
  handler: (input) => previewBlockTemplate(input),
});
const apply = defineAction({
  schema: blockApplySchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const result = await applyBlockTemplates(input, admin.id);
    refresh();
    return result;
  },
});
const cancel = defineAction({
  schema: z.object({ id: z.string().uuid() }),
  authorize: assertAdmin,
  handler: async ({ id }) => {
    const result = await cancelBlockApplication(id);
    refresh();
    return result;
  },
});
export async function saveBlockTemplateAction(
  input: BlockTemplateInput & { fingerprint: string },
) {
  return save(input);
}
export async function previewBlockTemplateAction(input: BlockTemplateInput) {
  return templatePreview(input);
}
export async function previewBlockApplicationAction(input: BlockPreviewInput) {
  return preview(input);
}
export async function applyBlockTemplatesAction(input: BlockApplyInput) {
  return apply(input);
}
export async function cancelBlockApplicationAction(input: { id: string }) {
  return cancel(input);
}
