import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A shared, quiet metric surface; values remain separate semantic items. */
export function StatGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div data-ui="stat-group" className={cn(className)} {...props} />;
}

/** A single KPI tile : one number with a label. Shared by dashboard + statistics. */
export function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div data-ui="stat-card">
      <div data-ui="stat-label">{label}</div>
      <div data-ui="stat-value">{value}</div>
    </div>
  );
}
