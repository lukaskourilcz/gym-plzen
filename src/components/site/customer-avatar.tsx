"use client";

import Image from "next/image";
import { useState } from "react";
import { googleAvatarUrl, profileInitials } from "@/lib/helpers/profile";

/** Account avatar: a validated Google photo, with initials on load failure. */
export function CustomerAvatar({
  name,
  photo,
}: {
  name: string;
  photo?: string | null;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const safePhoto = googleAvatarUrl(photo);
  return (
    <div
      role="img"
      aria-label={`Avatar: ${name.trim() || "zákazník"}`}
      className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-2xl font-bold text-accent-foreground"
    >
      {safePhoto && safePhoto !== failedPhoto ? (
        <Image
          src={safePhoto}
          alt=""
          width={80}
          height={80}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedPhoto(safePhoto)}
        />
      ) : (
        <span aria-hidden="true">{profileInitials(name)}</span>
      )}
    </div>
  );
}
