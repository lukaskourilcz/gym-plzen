import type { ComponentProps } from "react";
import type { Badge as PublicBadge } from "@/components/ui/badge";
import { Chip } from "../boardui/chip";
import { cx } from "../boardui/cx";

/** BoardUI's quiet caption chip with NAVI's existing status API. */
export function Badge({
  variant = "default",
  className,
  ...props
}: ComponentProps<typeof PublicBadge>) {
  return (
    <Chip
      {...props}
      variant="caption"
      color={variant === "default" || variant === "accent" ? "lime" : "soft"}
      data-ui="badge"
      className={cx(
        "rounded-sm px-2 py-1 text-xs font-medium whitespace-normal",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground",
        className,
      )}
    />
  );
}
