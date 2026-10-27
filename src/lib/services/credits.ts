import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import {
  creditAccount,
  creditEntry,
  creditHold,
  profiles,
} from "@/lib/db/schema";
import { assertMoney, creditTender } from "@/lib/config/credits";
import { ActionError } from "@/lib/helpers/action";

export async function creditAccountForUser(
  userId: string,
  tx: DatabaseExecutor = db,
) {
  await tx.insert(creditAccount).values({ userId }).onConflictDoNothing();
  const [account] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.userId, userId));
  if (!account) throw new ActionError("Kreditní účet nebyl nalezen.");
  return account;
}
/** Called ONLY with a Supabase-verified, confirmed email, never booking input. */
export async function claimGuestCredits(userId: string, verifiedEmail: string) {
  const email = verifiedEmail.trim().toLowerCase();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`credit-claim:${email}`}, 0))`,
    );
    const [guest] = await tx
      .select()
      .from(creditAccount)
      .where(eq(creditAccount.guestEmail, email))
      .for("update");
    if (!guest) return;
    const own = await creditAccountForUser(userId, tx);
    // Keep both historical accounts; transfer by paired immutable entries.
    if (guest.reservedCents)
      throw new ActionError("Kredit hosta je právě použit v platbě.");
    if (guest.balanceCents) {
      await postCreditIn(tx, {
        accountId: guest.id,
        amountCents: -guest.balanceCents,
        reason: "Převod do ověřeného zákaznického profilu",
        key: `claim-out:${guest.id}:${userId}`,
      });
      await postCreditIn(tx, {
        accountId: own.id,
        amountCents: guest.balanceCents,
        reason: "Kredit z předchozích návštěv bez registrace",
        key: `claim-in:${guest.id}:${userId}`,
      });
    }
    // Future admin grants find the registered account, not this historical one.
  });
}
export async function postCreditIn(
  tx: DatabaseExecutor,
  input: {
    accountId: string;
    amountCents: number;
    reason: string;
    key: string;
    actorId?: string;
    reservationId?: string;
  },
) {
  assertMoney(input.amountCents);
  if (!input.amountCents || !input.reason.trim())
    throw new ActionError("Vyplňte částku a důvod změny.");
  const [account] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.id, input.accountId))
    .for("update");
  if (!account) throw new ActionError("Kreditní účet nebyl nalezen.");
  const [existing] = await tx
    .select()
    .from(creditEntry)
    .where(eq(creditEntry.operationKey, input.key));
  if (existing) {
    if (
      existing.accountId !== account.id ||
      existing.amountCents !== input.amountCents
    )
      throw new ActionError("Tato operace už byla použita s jinou částkou.");
    return existing;
  }
  if (account.balanceCents + input.amountCents < account.reservedCents)
    throw new ActionError("Nelze odebrat použitý nebo rezervovaný kredit.");
  const [entry] = await tx
    .insert(creditEntry)
    .values({
      accountId: account.id,
      amountCents: input.amountCents,
      reason: input.reason.trim(),
      operationKey: input.key,
      actorId: input.actorId,
      reservationId: input.reservationId,
    })
    .returning();
  await tx
    .update(creditAccount)
    .set({
      balanceCents: account.balanceCents + input.amountCents,
      updatedAt: new Date(),
    })
    .where(eq(creditAccount.id, account.id));
  return entry!;
}
export async function reserveCreditIn(
  tx: DatabaseExecutor,
  userId: string,
  key: string,
  total: number,
  use: boolean,
) {
  const account = await creditAccountForUser(userId, tx);
  const [locked] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.id, account.id))
    .for("update");
  const [existing] = await tx
    .select()
    .from(creditHold)
    .where(eq(creditHold.operationKey, key));
  if (existing) {
    if (existing.accountId !== account.id || existing.status === "released")
      throw new ActionError("Platbu je potřeba zahájit znovu.");
    return existing.amountCents;
  }
  const amount = creditTender(
    total,
    locked!.balanceCents - locked!.reservedCents,
    use,
  );
  await tx
    .insert(creditHold)
    .values({ operationKey: key, accountId: account.id, amountCents: amount });
  await tx
    .update(creditAccount)
    .set({
      reservedCents: locked!.reservedCents + amount,
      updatedAt: new Date(),
    })
    .where(eq(creditAccount.id, account.id));
  return amount;
}
export async function finishCreditIn(
  tx: DatabaseExecutor,
  key: string,
  capture: boolean,
  reservationId?: string,
) {
  // Lock account before hold everywhere, avoiding account/hold lock inversions.
  const [found] = await tx
    .select()
    .from(creditHold)
    .where(eq(creditHold.operationKey, key));
  if (!found) return;
  const [account] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.id, found.accountId))
    .for("update");
  const [hold] = await tx
    .select()
    .from(creditHold)
    .where(eq(creditHold.operationKey, key))
    .for("update");
  if (hold?.status !== "reserved") return;
  await tx
    .update(creditAccount)
    .set({
      reservedCents: account!.reservedCents - hold.amountCents,
      updatedAt: new Date(),
    })
    .where(eq(creditAccount.id, found.accountId));
  if (capture && hold.amountCents)
    await postCreditIn(tx, {
      accountId: found.accountId,
      amountCents: -hold.amountCents,
      key: `spend:${key}`,
      reason: "Úhrada kreditem",
      reservationId,
    });
  await tx
    .update(creditHold)
    .set({ status: capture ? "captured" : "released" })
    .where(eq(creditHold.operationKey, key));
}
export async function getCreditWallet(userId: string) {
  const [account] = await db
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.userId, userId));
  const entries = account
    ? await db
        .select()
        .from(creditEntry)
        .where(eq(creditEntry.accountId, account.id))
        .orderBy(desc(creditEntry.createdAt), desc(creditEntry.id))
        .limit(50)
    : [];
  return {
    accountId: account?.id ?? null,
    balanceCents: account?.balanceCents ?? 0,
    reservedCents: account?.reservedCents ?? 0,
    availableCents:
      (account?.balanceCents ?? 0) - (account?.reservedCents ?? 0),
    entries,
  };
}
export async function adminCreditAccount(
  input: { userId?: string; email?: string; name?: string },
  tx: DatabaseExecutor,
) {
  if (input.userId) return creditAccountForUser(input.userId, tx);
  const email = input.email?.trim().toLowerCase();
  if (!email)
    throw new ActionError("Vyberte zákazníka nebo vyplňte e-mail hosta.");
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${email}`);
  if (profile) return creditAccountForUser(profile.id, tx);
  await tx
    .insert(creditAccount)
    .values({ guestEmail: email, guestName: input.name })
    .onConflictDoNothing();
  const [account] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.guestEmail, email));
  return account!;
}
