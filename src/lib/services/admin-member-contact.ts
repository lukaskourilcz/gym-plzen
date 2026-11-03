import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { toE164 } from "@/lib/helpers/phone";
import { splitFullName } from "@/lib/helpers/profile";
import {
  updateMemberContactSchema,
  type UpdateMemberContactValues,
} from "@/lib/validations/members";
import {
  memberAuthDirectory,
  type MemberAuthDirectory,
} from "./admin-member-auth";
import { recordIn } from "./activity";
import { withOperationLock } from "./operation-lock";

const normalizeEmail = (email: string | null) =>
  email?.trim().toLowerCase() ?? "";
export function memberContactSnapshot(profile: Profile) {
  return {
    email: profile.email,
    fullName: profile.fullName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
}

/** Called only after assertAdmin; updates one existing identity, never bookings. */
export async function updateMemberContact(
  raw: UpdateMemberContactValues,
  actor: { id: string; email: string },
  authFactory: () => MemberAuthDirectory = memberAuthDirectory,
) {
  const input = updateMemberContactSchema.parse(raw);
  return withOperationLock(`member-contact:${input.userId}`, async () => {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, input.userId))
      .limit(1);
    if (!profile) throw new ActionError("Zákazníka se nepodařilo najít.");
    const before = memberContactSnapshot(profile);
    const email = normalizeEmail(input.email);
    const fullName = input.fullName.trim().replace(/\s+/g, " ");
    const { firstName, lastName } = splitFullName(fullName);
    const phone = input.phone?.trim() ? toE164(input.phone) : null;
    if ((input.phone?.trim() && !phone) || (profile.phoneRequired && !phone))
      throw new ActionError("Zadejte platné telefonní číslo.");
    const desired = { fullName, firstName, lastName, email, phone };
    // A successful save whose response was lost is safe to submit again.
    if (
      Object.keys(before).every(
        (key) =>
          before[key as keyof typeof before] ===
          desired[key as keyof typeof desired],
      )
    )
      return;
    if (
      Object.keys(before).some(
        (key) =>
          before[key as keyof typeof before] !==
          input.expected[key as keyof typeof before],
      )
    )
      throw new ActionError(
        "Údaje zákazníka se mezitím změnily. Obnovte profil a zkuste to znovu.",
      );
    const emailChanged = normalizeEmail(profile.email) !== email;
    if (emailChanged) {
      const [duplicate] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(
            ne(profiles.id, input.userId),
            sql`lower(btrim(${profiles.email})) = ${email}`,
          ),
        )
        .limit(1);
      if (duplicate)
        throw new ActionError("Tento e-mail už používá jiný zákazník.");
      const auth = authFactory();
      const current = await auth.getEmail(input.userId);
      if (current !== normalizeEmail(profile.email) && current !== email)
        throw new ActionError(
          "Přihlašovací účet už má jiný e-mail. Obnovte profil před další úpravou.",
        );
      if (current !== email) await auth.setEmail(input.userId, email);
    }
    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(profiles)
          .set({
            fullName,
            firstName,
            lastName,
            email,
            phone,
            phoneVerified: sql`case when ${profiles.phone} is not distinct from ${phone} then ${profiles.phoneVerified} else false end`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(profiles.id, input.userId),
              ...Object.entries(before).map(
                ([field, value]) =>
                  sql`${profiles[field as keyof typeof before]} is not distinct from ${value}`,
              ),
            ),
          )
          .returning({ id: profiles.id });
        if (!updated)
          throw new ActionError(
            "Údaje zákazníka se mezitím změnily. Obnovte profil a zkuste to znovu.",
          );
        await recordIn(tx, {
          action: "member.profile_updated",
          actorType: "admin",
          actorId: actor.id,
          actorLabel: actor.email,
          memberId: input.userId,
          summary: "Správce upravil jméno, e-mail nebo telefon zákazníka.",
          context: {
            changedFields: Object.keys(before).filter(
              (key) =>
                before[key as keyof typeof before] !==
                desired[key as keyof typeof before],
            ),
          },
        });
      });
    } catch (error) {
      if (!emailChanged) throw error;
      // Auth and application storage are separate systems. A retry of these
      // same values safely finishes a partial save; never undo a newer email.
      throw new ActionError(
        "Přihlašovací e-mail byl změněn, ale uložení profilu se nedokončilo. Znovu uložte stejné údaje; pokud se profil mezitím změnil, nejprve jej obnovte.",
      );
    }
  });
}
