import { randomUUID } from "node:crypto";
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
      if (existing.accountId !== account.id || existing.actorId !== actorId)
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
  const q = `%${input.q}%`;
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
    where (name ilike ${q} or email ilike ${q})
      and (${input.balance} <> 'positive' or balance-reserved>0)
      and (${input.balance} <> 'zero' or balance-reserved=0)
      and (${input.registration} <> 'registered' or registered)
      and (${input.registration} <> 'guest' or not registered)
    order by ${input.sort === "name" ? sql`name asc` : input.sort === "updated" ? sql`updated desc nulls last` : sql`balance desc`},id
    limit 21 offset ${(input.page - 1) * 20}`);
  return result as unknown as CreditCustomer[];
}
export const newCreditOperationId = () => randomUUID();
