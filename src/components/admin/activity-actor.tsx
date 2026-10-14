import type { ActivityLog } from "@/lib/db/types";
import { ACTOR_LABELS } from "@/lib/services/activity";
import { AdminMemberName } from "./member-name";

/** Who acted: the role, and the name or e-mail recorded at the time. */
export function ActivityActor({
  entry,
  note,
}: {
  entry: ActivityLog;
  note?: string | null;
}) {
  return (
    <span>
      <span className="font-bold">{ACTOR_LABELS[entry.actorType]}</span>
      {entry.actorLabel ? (
        <span className="block text-xs text-muted-foreground">
          <AdminMemberName name={entry.actorLabel} note={note} />
        </span>
      ) : null}
    </span>
  );
}
