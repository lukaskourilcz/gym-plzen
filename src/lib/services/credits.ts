import { desc, eq, sql } from "drizzle-orm";
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
  // Most signed-in requests have no guest wallet. Avoid a transaction/advisory
  // lock on every page, while still rechecking the actual transfer under lock.
  const [candidate] = await db
    .select({ balance: creditAccount.balanceCents })
    .from(creditAccount)
    .where(eq(creditAccount.guestEmail, email));
  if (!candidate?.balance) return;
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
      const [lastEntry] = await tx
        .select({ id: creditEntry.id })
        .from(creditEntry)
        .where(eq(creditEntry.accountId, guest.id))
        .orderBy(desc(creditEntry.createdAt), desc(creditEntry.id))
        .limit(1);
      if (!lastEntry)
        throw new ActionError("Historii kreditu musí ověřit obsluha.");
      const revision = lastEntry.id;
      await postCreditIn(tx, {
        accountId: guest.id,
        amountCents: -guest.balanceCents,
        reason: "Převod do ověřeného zákaznického profilu",
        key: `claim-out:${guest.id}:${userId}:${revision}`,
      });
      await postCreditIn(tx, {
        accountId: own.id,
        amountCents: guest.balanceCents,
        reason: "Kredit z předchozích návštěv bez registrace",
        key: `claim-in:${guest.id}:${userId}:${revision}`,
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
/** Checkout needs a balance, never a customer's full audit history. */
export async function getCreditBalance(userId: string) {
  const [account] = await db
    .select({
      id: creditAccount.id,
      balanceCents: creditAccount.balanceCents,
      reservedCents: creditAccount.reservedCents,
    })
    .from(creditAccount)
    .where(eq(creditAccount.userId, userId));
  return {
    accountId: account?.id ?? null,
    balanceCents: account?.balanceCents ?? 0,
    reservedCents: account?.reservedCents ?? 0,
    availableCents:
      (account?.balanceCents ?? 0) - (account?.reservedCents ?? 0),
  };
}
export async function getCreditWallet(userId: string) {
  const balance = await getCreditBalance(userId);
  const entries = balance.accountId
    ? (
        await db
          .select({
            entry: creditEntry,
            actorName: profiles.fullName,
            actorEmail: profiles.email,
          })
          .from(creditEntry)
          .leftJoin(profiles, eq(profiles.id, creditEntry.actorId))
          .where(eq(creditEntry.accountId, balance.accountId))
          .orderBy(desc(creditEntry.createdAt), desc(creditEntry.id))
          .limit(50)
      ).map(({ entry, actorName, actorEmail }) => ({
        ...entry,
        actorName: actorName || actorEmail || "Systém",
      }))
    : [];

  return { ...balance, entries };
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

/** Positive tender must have a matching live reservation of this owner's funds. */
export async function assertCreditFundingIn(
  tx: DatabaseExecutor,
  key: string,
  amountCents: number,
  userId: string | null,
) {
  if (amountCents === 0) return;
  const [funding] = await tx
    .select({ hold: creditHold, owner: creditAccount.userId })
    .from(creditHold)
    .innerJoin(creditAccount, eq(creditAccount.id, creditHold.accountId))
    .where(eq(creditHold.operationKey, key));
  if (
    !userId ||
    !funding ||
    funding.owner !== userId ||
    funding.hold.amountCents !== amountCents ||
    funding.hold.status !== "reserved"
  )
    throw new ActionError(
      "Kreditní úhradu se nepodařilo ověřit. Další platbu nezakládejte a kontaktujte obsluhu.",
    );
}
