import type { ReactNode } from "react";
import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import type { RegistrationNoticeCopy } from "@/lib/content/registration-notice";

/** Shared public/editor layout. Without a destination the preview has no live auth link. */
export function RegistrationNotice({
  copy,
  returnTo,
  className,
}: {
  copy: RegistrationNoticeCopy<ReactNode>;
  returnTo?: string;
  className?: string;
}) {
  const linkClass =
    "font-bold text-accent-foreground underline whitespace-pre-wrap break-words";
  return (
    <Notice
      title={
        <span className="whitespace-pre-wrap break-words">{copy.title}</span>
      }
      className={className}
    >
      <p className="whitespace-pre-wrap break-words">{copy.body}</p>
      <p className="mt-2">
        {returnTo ? (
          <Link
            href={`/login?next=${encodeURIComponent(returnTo)}`}
            className={linkClass}
          >
            {copy.link}
          </Link>
        ) : (
          <span className={linkClass}>{copy.link}</span>
        )}
        <span className="ml-2 whitespace-pre-wrap break-words">
          {copy.guestNote}
        </span>
      </p>
    </Notice>
  );
}
