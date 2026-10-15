import { UserRound, UserRoundMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MemberRegistrationBadge({
  registered,
}: {
  registered: boolean;
}) {
  const Icon = registered ? UserRound : UserRoundMinus;
  return (
    <Badge variant={registered ? "accent" : "muted"}>
      <Icon className="size-3.5" aria-hidden="true" />
      {registered ? "Registrovaný" : "Neregistrovaný"}
    </Badge>
  );
}
