import type { ActivityLog } from "@/lib/db/types";
import { ACTOR_LABELS } from "@/lib/services/activity";

/** Who acted: the role, and the name or e-mail recorded at the time. */
export function ActivityActor({ entry }: { entry: ActivityLog }) {
  return (
    <span>
      <span className="font-bold">{ACTOR_LABELS[entry.actorType]}</span>
      {entry.actorLabel ? (
        <span className="block text-xs text-muted-foreground">
          {entry.actorLabel}
        </span>
      ) : null}
    </span>
  );
}
