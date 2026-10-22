"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Layers, Play, ImageOff } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/site/social-icons";
import {
  INSTAGRAM_PROFILE_URL,
  INSTAGRAM_USERNAME,
  type InstagramPost,
} from "@/lib/config/instagram";
import { Container } from "@/components/ui/container";

export type InstagramCopy = {
  title: ReactNode;
  button: ReactNode;
  fallback: ReactNode;
  more: ReactNode;
};
export function InstagramThumbnail({ post }: { post: InstagramPost }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-square overflow-hidden bg-primary/10">
      {failed || post.hidden ? (
        <div className="absolute inset-0 flex items-center justify-center text-primary">
          <ImageOff className="size-7" aria-hidden="true" />
        </div>
      ) : (
        <Image
          src={`/api/instagram/media/${post.id}`}
          alt={
            post.caption
              ? post.caption.slice(0, 180)
              : "Příspěvek NAVI Private Gym"
          }
          fill
          sizes="(max-width: 767px) 50vw, 17vw"
          unoptimized
          loading="lazy"
          className="object-cover transition-transform duration-200 motion-reduce:transition-none group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      )}
      {post.kind !== "IMAGE" && (
        <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white">
          {post.kind === "VIDEO" ? (
            <Play className="size-4" aria-hidden="true" />
          ) : (
            <Layers className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {post.kind === "VIDEO" ? "Reel" : "Více fotografií"}
          </span>
        </span>
      )}
    </div>
  );
}
/** Only local images are loaded. Instagram receives a visit only after following a link. */
export function InstagramFeed({
  posts,
  copy,
  preview = false,
}: {
  posts: InstagramPost[];
  copy: InstagramCopy;
  preview?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      id={preview ? undefined : "instagram"}
      aria-label="Instagram NAVI"
      className="scroll-mt-[var(--header-h)] bg-background py-10 sm:py-14"
    >
      <Container>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              @{INSTAGRAM_USERNAME}
            </p>
          </div>
          {preview ? (
            <div className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">
              <Instagram className="size-4 shrink-0" aria-hidden="true" />
              {copy.button}
            </div>
          ) : (
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <Instagram className="size-4" aria-hidden="true" />
              {copy.button}
            </a>
          )}
        </div>
        {posts.length ? (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              {posts.slice(0, 12).map((post, i) => (
                <div
                  key={post.id}
                  className={i >= 4 && !expanded ? "hidden md:block" : ""}
                >
                  {preview ? (
                    <InstagramThumbnail post={post} />
                  ) : (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Otevřít příspěvek na Instagramu: ${post.caption.slice(0, 140) || "NAVI Private Gym"}`}
                    >
                      <InstagramThumbnail post={post} />
                    </a>
                  )}
                </div>
              ))}
            </div>
            {posts.length > 4 && !expanded && !preview && (
              <button
                type="button"
                className="mt-5 min-h-11 w-full rounded-md border border-border px-4 py-2 font-bold md:hidden"
                onClick={() => setExpanded(true)}
                aria-expanded={expanded}
              >
                {copy.more}
              </button>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-border bg-card px-5 py-8 text-sm leading-6 text-muted-foreground">
            {copy.fallback}
          </p>
        )}
      </Container>
    </section>
  );
}
