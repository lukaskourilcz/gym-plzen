import { env } from "@/lib/env";
import {
  isNukiConfigured,
  readLockConnectivity,
} from "@/lib/integrations/nuki";
import { getSetting, setSetting } from "./cms";
import { raiseAlert, resolveAlert } from "./alerts";
import { withOperationLock } from "./operation-lock";
export interface LockHealth {
  checkedAt: string;
  unavailableSince: string | null;
  state: "online" | "offline" | "unknown";
}
export function nextLockHealth(
  previous: LockHealth | null,
  state: LockHealth["state"],
  now: Date,
): LockHealth {
  return {
    checkedAt: now.toISOString(),
    state,
    unavailableSince:
      state === "online"
        ? null
        : (previous?.unavailableSince ?? now.toISOString()),
  };
}
/** Five-minute polling; alert after 15 minutes without verified connectivity. */
export async function monitorLockConnectivity(now = new Date()) {
  if (!isNukiConfigured()) return;
  const key = `nuki-health:${env.NUKI_SMARTLOCK_ID}`;
  return withOperationLock(key, async () => {
    const previous = await getSetting<LockHealth>(key);
    if (previous && now.getTime() - Date.parse(previous.checkedAt) < 5 * 60_000)
      return previous;
    const health = nextLockHealth(previous, await readLockConnectivity(), now);
    await setSetting(key, health);
    if (health.state === "online") await resolveAlert(key);
    else if (
      health.unavailableSince &&
      now.getTime() - Date.parse(health.unavailableSince) >= 15 * 60_000
    ) {
      await raiseAlert({
        severity: "critical",
        dedupeKey: key,
        title:
          health.state === "offline"
            ? "Nuki hlásí nedostupný zámek"
            : "Dostupnost zámku Nuki nelze ověřit",
        body: "Nejméně 15 minut není potvrzené spojení se zámkem. Zkontrolujte napájení, Wi-Fi a Nuki. U nejbližších rezervací zajistěte náhradní vstup, pokud kód ještě není připravený.",
        context: {
          unavailableSince: health.unavailableSince,
          state: health.state,
        },
      });
    }
    return health;
  });
}
