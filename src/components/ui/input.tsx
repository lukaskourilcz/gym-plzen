import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui-style text input. */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium sm:text-sm",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
