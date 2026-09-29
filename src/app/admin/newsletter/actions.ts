"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { activity, newsletter } from "@/lib/services";

const schema = z.object({ email: z.string().email().max(254) });

/** Withdraw consent on the subscriber's request (by e-mail or in person). */
const unsubscribeImpl = defineAction({
  schema,
  authorize: assertAdmin,
  handler: async ({ email }, admin) => {
    await newsletter.unsubscribe(email);
    await activity.record({
      action: "newsletter.unsubscribed",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Odběr novinek pro ${email} zrušen na žádost odběratele.`,
    });
    revalidatePath("/admin/newsletter");
    return null;
  },
});

export async function adminUnsubscribeAction(
  input: z.infer<typeof schema>,
): Promise<Result<null>> {
  return unsubscribeImpl(input);
}
