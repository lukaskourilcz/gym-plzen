import { searchPattern } from "@/lib/helpers/admin-list";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditAccount, creditEntry } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
import { adminCreditAccount, postCreditIn } from "./credits";
export async function adjustCustomerCredit(
  input: {
    userId?: string;
    email?: string;
    name?: string;
    mode: "add" | "remove" | "set";
    amountCents: number;
    expectedBalance: number;
    reason: string;
    key: string;
  },
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const account = await adminCreditAccount(input, tx);
    const [locked] = await tx
      .select()
      .from(creditAccount)
      .where(eq(creditAccount.id, account.id))
      .for("update");
    const [existing] = await tx
      .select()
      .from(creditEntry)
      .where(eq(creditEntry.operationKey, `admin:${input.key}`));
    if (existing) {
      if (
        existing.accountId !== account.id ||
        existing.actorId !== actorId ||
        existing.reason !== input.reason.trim() ||
        existing.amountCents !==
          (input.mode === "set"
            ? input.amountCents - input.expectedBalance
            : input.mode === "remove"
              ? -input.amountCents
              : input.amountCents)
      )
        throw new ActionError("Operace nepatří tomuto zákazníkovi.");
      return;
    }
    if (locked!.balanceCents !== input.expectedBalance)
      throw new ActionError(
        "Zůstatek se mezitím změnil. Obnovte stránku a zkontrolujte částku.",
      );
    const amount =
      input.mode === "set"
        ? input.amountCents - locked!.balanceCents
        : input.mode === "remove"
          ? -input.amountCents
          : input.amountCents;
    if (amount === 0) return;
    await postCreditIn(tx, {
      accountId: account.id,
      amountCents: amount,
      reason: input.reason,
      key: `admin:${input.key}`,
      actorId,
    });
  });
}
export interface CreditCustomer {
  id: string;
  name: string;
  email: string;
  balance: number;
  reserved: number;
  updated: Date | null;
  registered: boolean;
  total: number;
}
export async function creditCustomers(input: {
  q: string;
  balance: string;
  registration: string;
  page: number;
  sort: string;
}) {
  const q = searchPattern(input.q);
  const result = await db.execute(sql`
    with customers as (
      select p.id,coalesce(nullif(p.full_name,''),p.email,'Zákazník') as name,p.email,
        coalesce(a.balance_cents,0) as balance,coalesce(a.reserved_cents,0) as reserved,a.updated_at as updated,true as registered
      from profiles p left join credit_account a on a.user_id=p.id
      union all
      select a.id,coalesce(a.guest_name,a.guest_email),a.guest_email,a.balance_cents,a.reserved_cents,a.updated_at,false
      from credit_account a where a.guest_email is not null
        and not exists(select 1 from profiles p where lower(p.email)=a.guest_email)
    ) select *,count(*) over()::int as total from customers
    where (translate(lower(coalesce(name,'')), 'áčďéěíňóřšťúůýž', 'acdeeinorstuuyz') like ${q} or lower(coalesce(email,'')) like ${q})
      and (${input.balance} <> 'positive' or balance-reserved>0)
      and (${input.balance} <> 'zero' or balance-reserved=0)
      and (${input.registration} <> 'registered' or registered)
      and (${input.registration} <> 'guest' or not registered)
    order by ${input.sort === "name" ? sql`name asc` : input.sort === "updated" ? sql`updated desc nulls last` : sql`balance desc`},id
    limit 21 offset ${(input.page - 1) * 20}`);
  return result as unknown as CreditCustomer[];
}

export async function confirmChangeRefund(
  id: string,
  reference: string,
  actorId: string,
) {
  const { payment, reservationChange } = await import("@/lib/db/schema");
  const { withReservationLock } = await import("./operation-lock");
  const { resolveAlert } = await import("./alerts");
  const [known] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  if (!known) throw new ActionError("Změna nebyla nalezena.");
  await withReservationLock(known.reservationId, () =>
    db.transaction(async (tx) => {
      const [change] = await tx
        .select()
        .from(reservationChange)
        .where(eq(reservationChange.id, id))
        .for("update");
      if (change?.status === "refunded") return;
      if (change?.status !== "refund_pending")
        throw new ActionError(
          "Nejdříve musí být ověřená náprava rezervace a připravená refundace.",
        );
      const [attempt] = await tx
        .select()
        .from(payment)
        .where(eq(payment.reservationChangeId, id))
        .for("update");
      if (!attempt || attempt.status !== "succeeded")
        throw new ActionError("Přijatý doplatek nebyl nalezen.");
      await tx
        .update(reservationChange)
        .set({
          status: "refunded",
          refundState: "confirmed",
          refundReference: `${reference} · správce ${actorId}`,
          updatedAt: new Date(),
        })
        .where(eq(reservationChange.id, id));
      await tx
        .update(payment)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(payment.id, attempt.id));
    }),
  );
  await resolveAlert(`reservation-change:${id}`);
}
