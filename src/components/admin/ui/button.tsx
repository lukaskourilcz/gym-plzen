import Link from "next/link";
import type { ButtonProps } from "@/components/ui/button";
import { Button as BoardButton, buttonStyles } from "../boardui/button";
import { cx } from "../boardui/cx";

const variants = {
  default: "primary",
  ink: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
  link: "ghost",
} as const;

/** Keep the application's native form and Next Link API over BoardUI source. */
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cx(
    buttonStyles.base,
    buttonStyles.size.medium,
    buttonStyles.variant[variants[variant ?? "default"]],
    "admin-button h-auto min-h-11 min-w-0 gap-2 whitespace-normal rounded-md px-4 py-2 font-medium shadow-none [&>span]:min-w-0 [&>span]:shrink [&>span]:gap-2 [&>span]:whitespace-normal [&_svg]:size-4 [&_svg]:shrink-0",
    size === "lg" && "min-h-12 px-6",
    size === "icon" && "size-11 px-0",
    variant === "ink" && "bg-ink text-ink-foreground hover:bg-ink/90",
    (variant == null || variant === "default") && "hover:bg-primary/90",
    variant === "destructive" && "hover:bg-destructive/90",
    variant === "link" &&
      "bg-transparent px-0 text-accent-foreground hover:bg-transparent hover:underline",
    className,
  );
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  const classes = buttonVariants({ variant, size, className });
  if ("href" in props && props.href !== undefined) {
    return <Link data-ui="button" className={classes} {...props} />;
  }
  return (
    <BoardButton
      {...props}
      data-ui="button"
      variant={variants[variant ?? "default"]}
      // Existing forms rely on the browser's implicit submit default.
      type={props.type ?? "submit"}
      className={classes}
    />
  );
}

export type { ButtonProps };
