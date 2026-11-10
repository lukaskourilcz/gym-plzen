import { z } from "zod";
import { httpRequest } from "@/lib/helpers/http";
import {
  diagnoseNuki,
  nukiApiFailure,
  NUKI_STATUS_URL,
  type NukiApiObservation,
  type NukiServiceObservation,
} from "@/lib/helpers/nuki-diagnostics";

const services = ["Nuki Web", "Nuki REST API", "Nuki Remote Access"] as const;
const summarySchema = z.object({
  components: z.array(
    z.object({
      name: z.string(),
      status: z.enum([
        "operational",
        "degraded_performance",
        "partial_outage",
        "major_outage",
        "under_maintenance",
      ]),
    }),
  ),
});

/** Only the services used by this integration count, never unrelated incidents. */
export async function readNukiServiceStatus(
  request: typeof httpRequest = httpRequest,
): Promise<NukiServiceObservation> {
  try {
    const raw = await request<unknown>(
      `${NUKI_STATUS_URL}/api/v2/summary.json`,
      {
        cache: "no-store",
        timeoutMs: 5000,
        retries: 0,
      },
    );
    const parsed = summarySchema.safeParse(raw);
    if (!parsed.success) throw new Error("Invalid Nuki status response");
    const relevant = parsed.data.components.filter((c) =>
      services.some((s) => s === c.name),
    );
    const affectedServices = services.filter((name) =>
      relevant.some((c) => c.name === name && c.status !== "operational"),
    );
    return {
      serviceStatus: affectedServices.length
        ? "incident"
        : services.every((name) => relevant.some((c) => c.name === name))
          ? "operational"
          : "unknown",
      affectedServices,
    };
  } catch {
    return { serviceStatus: "unknown", affectedServices: [] };
  }
}

/** Both probes are read-only, bounded and independent; status-page failure cannot hide an online lock. */
export function createNukiHealthClient(
  config: { token: string; lockId: string },
  request: typeof httpRequest = httpRequest,
) {
  async function readLock(): Promise<NukiApiObservation> {
    try {
      const device = await request<unknown>(
        `https://api.nuki.io/smartlock/${config.lockId}`,
        {
          headers: { authorization: `Bearer ${config.token}` },
          cache: "no-store",
          timeoutMs: 5000,
          retries: 0,
        },
      );
      const parsed = z
        .object({ serverState: z.number().int() })
        .safeParse(device);
      const state = parsed.success ? parsed.data.serverState : null;
      return {
        state: state === 0 ? "online" : state === 4 ? "offline" : "unknown",
        failure: state === 0 || state === 4 ? null : "invalid_response",
        httpStatus: 200,
      };
    } catch (error) {
      return nukiApiFailure(error);
    }
  }
  return {
    async check() {
      const [api, service] = await Promise.all([
        readLock(),
        readNukiServiceStatus(request),
      ]);
      return diagnoseNuki(api, service);
    },
  };
}
