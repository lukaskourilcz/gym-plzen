import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui-style label. */
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "mb-1.5 block text-sm font-medium text-foreground",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
