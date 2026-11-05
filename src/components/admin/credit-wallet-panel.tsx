import { getCreditBalance } from "@/lib/services/credits";
import { AdminCreditWallet } from "./credit-wallet";

export async function AdminCreditWalletPanel({ userId }: { userId: string }) {
  const balance = await getCreditBalance(userId);
  return (
    <AdminCreditWallet
      userId={userId}
      balance={balance.balanceCents}
      reserved={balance.reservedCents}
    />
  );
}
