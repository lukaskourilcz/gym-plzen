import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui-style Button. Kept API-compatible with the official component so
 * official shadcn variants drop in later. Renders an `<a>` when `href` is given.
 */
const buttonVariants = cva(
  // No `focus-visible:outline-none` here: the global outline in globals.css is
  // the single focus indicator and it is tuned to pass on light and ink alike.
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-extrabold transition-[background-color,border-color,color,transform] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        ink: "bg-ink text-ink-foreground hover:bg-ink/90",
        outline:
          "border border-border bg-transparent hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "min-h-11 px-4",
        lg: "min-h-12 px-7 text-base",
        icon: "size-11 min-h-11 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string;
};

type ButtonAsButton = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props;
    return <Link href={href} className={classes} {...rest} />;
  }
  return <button className={classes} {...(props as ButtonAsButton)} />;
}
