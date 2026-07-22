import { Card, CardContent } from "@/components/ui/card";

/** A single KPI tile : one number with a label. Shared by dashboard + statistics. */
export function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card className="min-w-40 flex-1">
      <CardContent className="p-4">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
