"use client";

import {
  IconButton as BoardIconButton,
  IconLinkButton as BoardIconLink,
  type IconButtonProps,
  type IconLinkButtonProps,
} from "../boardui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cx } from "../boardui/cx";

export function IconButton({ className, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BoardIconButton
          {...props}
          data-ui="icon-button"
          className={cx(
            "size-11 rounded-md border-transparent bg-transparent shadow-none",
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{props["aria-label"]}</TooltipContent>
    </Tooltip>
  );
}

export function IconLink({ className, ...props }: IconLinkButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BoardIconLink
          {...props}
          data-ui="icon-button"
          className={cx(
            "size-11 rounded-md border-transparent bg-transparent shadow-none",
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{props["aria-label"]}</TooltipContent>
    </Tooltip>
  );
}
