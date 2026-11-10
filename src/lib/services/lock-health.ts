import { env } from "@/lib/env";
import { isNukiConfigured } from "@/lib/integrations/nuki";
import { createNukiHealthClient } from "@/lib/integrations/nuki-health";
import {
  describeNukiDiagnosis,
  type NukiDiagnosis,
} from "@/lib/helpers/nuki-diagnostics";
import { getSetting, setSetting } from "./cms";
import { raiseAlert, resolveAlert } from "./alerts";
import { withOperationLock } from "./operation-lock";
export interface LockHealth {
  checkedAt: string;
  unavailableSince: string | null;
  state: "online" | "offline" | "unknown";
  diagnosis?: NukiDiagnosis;
}
export function nextLockHealth(
  previous: LockHealth | null,
  state: LockHealth["state"],
  now: Date,
  diagnosis?: NukiDiagnosis,
): LockHealth {
  const healthy = diagnosis ? diagnosis.code === "online" : state === "online";
  return {
    checkedAt: now.toISOString(),
    state,
    ...(diagnosis ? { diagnosis } : {}),
    unavailableSince: healthy
      ? null
      : (previous?.unavailableSince ?? now.toISOString()),
  };
}
/** Five-minute polling; alert after 15 minutes, retaining independent lock/cloud evidence. */
export async function monitorLockConnectivity(now = new Date()) {
  if (!isNukiConfigured()) return;
  const key = `nuki-health:${env.NUKI_SMARTLOCK_ID}`;
  return withOperationLock(key, async () => {
    const previous = await getSetting<LockHealth>(key);
    if (previous && now.getTime() - Date.parse(previous.checkedAt) < 5 * 60_000)
      return previous;
    const diagnosis = await createNukiHealthClient({
      token: env.NUKI_API_TOKEN!,
      lockId: env.NUKI_SMARTLOCK_ID!,
    }).check();
    const health = nextLockHealth(
      previous,
      diagnosis.lockState,
      now,
      diagnosis,
    );
    await setSetting(key, health);
    if (diagnosis.code === "online")
      await resolveAlert(key, {
        kind: "recovered",
        message:
          "Nuki API znovu potvrdilo spojení se zámkem a není známý incident služby. Připravenost kódů ověřují jednotlivé rezervace.",
      });
    else if (
      health.unavailableSince &&
      now.getTime() - Date.parse(health.unavailableSince) >= 15 * 60_000
    ) {
      const description = describeNukiDiagnosis(diagnosis);
      await raiseAlert({
        severity: "critical",
        dedupeKey: key,
        title: description.title,
        body: description.body,
        context: {
          unavailableSince: health.unavailableSince,
          state: health.state,
          checkedAt: health.checkedAt,
          nukiDiagnosis: diagnosis,
        },
      });
    }
    return health;
  });
}
