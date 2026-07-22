import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: "border-info/30 bg-info/10 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  error: "border-destructive/30 bg-destructive/10 text-foreground",
} as const;

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof styles;
  title?: string;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = icons[tone];
  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 rounded-md border p-4 text-sm leading-relaxed",
        styles[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        {title ? <div className="font-extrabold">{title}</div> : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}
