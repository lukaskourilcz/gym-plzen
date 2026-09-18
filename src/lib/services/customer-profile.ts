import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
import { toE164 } from "@/lib/helpers/phone";
import type { ProfileValues } from "@/lib/validations/profile";

/** Explicit allowlist: customer input can never change a role or admin note. */
export async function saveCustomerProfile(
  userId: string,
  input: ProfileValues,
) {
  const phone = input.phone.trim() ? toE164(input.phone) : null;
  const [updated] = await db
    .update(profiles)
    .set({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fullName: `${input.firstName.trim()} ${input.lastName.trim()}`,
      phone,
      phoneVerified: sql`case when ${profiles.phone} is not distinct from ${phone} then ${profiles.phoneVerified} else false end`,
      notifyByWhatsapp: input.notifyByWhatsapp,
      avatarSource: input.avatarSource,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id });
  if (!updated) throw new ActionError("Profil se nepodařilo najít.");
}

/**
 * Keep the number a member typed into a booking, because they asked for it
 * with the checkbox next to the field. The next booking then prefills it.
 *
 * The update only matches a row whose number actually differs, so confirming
 * an unchanged number neither bumps `updatedAt` nor drops a verification that
 * still holds. A changed number is unverified again, as in the profile form.
 */
export async function saveBookingPhone(
  userId: string,
  phone: string,
): Promise<void> {
  await db
    .update(profiles)
    .set({ phone, phoneVerified: false, updatedAt: new Date() })
    .where(
      and(
        eq(profiles.id, userId),
        sql`${profiles.phone} is distinct from ${phone}`,
      ),
    );
}
