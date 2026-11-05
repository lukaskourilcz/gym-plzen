"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Play,
  ImageOff,
} from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/site/social-icons";
import {
  INSTAGRAM_PROFILE_URL,
  INSTAGRAM_USERNAME,
  type InstagramPost,
  type InstagramProfile,
} from "@/lib/config/instagram";
import { Container } from "@/components/ui/container";
import { Dialog } from "@/components/ui/dialog";
import { BrandMark } from "./brand";
import "./instagram-feed.css";

export type InstagramCopy = {
  title: ReactNode;
  button: ReactNode;
  fallback: ReactNode;
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
          sizes="(max-width: 479px) 100vw, (max-width: 767px) 50vw, 320px"
          unoptimized
          loading="lazy"
          className="object-cover transition-transform duration-300 motion-reduce:transition-none motion-safe:group-hover:scale-110"
          onError={() => setFailed(true)}
        />
      )}
      {post.kind !== "IMAGE" && (
        <span className="absolute right-3 top-3 text-white drop-shadow-md">
          {post.kind === "VIDEO" ? (
            <Play className="size-5" aria-hidden="true" />
          ) : (
            <Layers className="size-5" aria-hidden="true" />
          )}
          <span className="sr-only">
            {post.kind === "VIDEO" ? "Reel" : "Více fotografií"}
          </span>
        </span>
      )}
    </div>
  );
}

/** Match the reference's automatic tile sizing, including its two-row mobile slider. */
function columnsForWidth(width: number) {
  const minimum = width >= 1024 ? 280 : width >= 480 ? 220 : 180;
  return Math.max(1, Math.floor(width / minimum));
}

/** Local thumbnails and a native dialog; visiting Instagram is always an explicit link. */
export function InstagramFeed({
  posts,
  profile,
  copy,
  preview = false,
}: {
  posts: InstagramPost[];
  profile?: InstagramProfile | null;
  copy: InstagramCopy;
  preview?: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const railId = useId();
  const visiblePosts = posts.slice(0, 12);
  const perPage = columns * 2;
  const pages = Array.from(
    { length: Math.ceil(visiblePosts.length / perPage) },
    (_, i) => visiblePosts.slice(i * perPage, (i + 1) * perPage),
  );
  const selected = visiblePosts.find((post) => post.id === selectedId);
  const selectedIndex = visiblePosts.findIndex(
    (post) => post.id === selectedId,
  );

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    let previousWidth = -1;
    const update = () => {
      const width = element.clientWidth;
      if (width === previousWidth) return;
      previousWidth = width;
      setColumns(columnsForWidth(width));
      element.scrollLeft = 0;
      setPage(0);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [posts.length]);

  function moveTo(next: number) {
    const element = rail.current;
    if (!element) return;
    const target = Math.max(0, Math.min(next, pages.length - 1));
    element.scrollTo({
      left: target * element.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <section
      id={preview ? undefined : "instagram"}
      aria-label="Instagram NAVI"
      className="instagram-feed scroll-mt-[var(--header-h)] bg-background py-10 sm:py-14"
    >
      <Container>
        <div className="instagram-panel">
          <div className="instagram-profile">
            <div className="instagram-profile-identity">
              <span className="instagram-avatar" aria-hidden="true">
                <span>
                  <BrandMark decorative className="size-8 text-gold" />
                </span>
              </span>
              <div>
                <h2 className="text-base font-bold leading-6">{copy.title}</h2>
                <p className="text-xs leading-5 text-neutral-600">
                  @{INSTAGRAM_USERNAME}
                </p>
              </div>
            </div>
            {profile && (
              <dl
                className="instagram-profile-stats"
                aria-label="Statistiky instagramového profilu"
              >
                {[
                  ["Příspěvky", profile.postsCount],
                  ["Sledující", profile.followersCount],
                  ["Sleduje", profile.followingCount],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <dt className="text-xs text-neutral-600">{label}</dt>
                    <dd className="order-first text-sm font-bold">
                      {typeof value === "number"
                        ? value.toLocaleString("cs-CZ")
                        : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {preview ? (
              <span className="instagram-follow">
                <Instagram className="size-4" aria-hidden="true" />
                {copy.button}
              </span>
            ) : (
              <a
                href={INSTAGRAM_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="instagram-follow"
              >
                <Instagram className="size-4" aria-hidden="true" />
                {copy.button}
              </a>
            )}
          </div>
          {visiblePosts.length ? (
            <div
              className="instagram-gallery"
              role="region"
              aria-roledescription="karusel"
              aria-label="Příspěvky z Instagramu"
            >
              <div
                ref={rail}
                id={railId}
                className="instagram-rail"
                onScroll={(event) => {
                  const el = event.currentTarget;
                  setPage(Math.round(el.scrollLeft / el.clientWidth));
                }}
              >
                {pages.map((items, i) => (
                  <div
                    key={i}
                    className="instagram-slide"
                    role="group"
                    aria-roledescription="snímek"
                    aria-label={`${i + 1} z ${pages.length}`}
                    style={{
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    }}
                  >
                    {items.map((post) =>
                      preview ? (
                        <div key={post.id}>
                          <InstagramThumbnail post={post} />
                        </div>
                      ) : (
                        <button
                          key={post.id}
                          type="button"
                          className="instagram-post group"
                          onClick={() => setSelectedId(post.id)}
                          aria-haspopup="dialog"
                          aria-label={`Zobrazit příspěvek: ${post.caption.slice(0, 140) || "NAVI Private Gym"}`}
                        >
                          <InstagramThumbnail post={post} />
                          <span
                            className="instagram-post-overlay"
                            aria-hidden="true"
                          >
                            <Instagram className="mx-auto mb-3 size-6" />
                            <span className="line-clamp-5 text-sm leading-6">
                              {post.caption}
                            </span>
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ))}
              </div>
              {!preview && pages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="instagram-arrow instagram-arrow-prev"
                    aria-label="Předchozí příspěvky"
                    aria-controls={railId}
                    disabled={page === 0}
                    onClick={() => moveTo(page - 1)}
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="instagram-arrow instagram-arrow-next"
                    aria-label="Další příspěvky"
                    aria-controls={railId}
                    disabled={page >= pages.length - 1}
                    onClick={() => moveTo(page + 1)}
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </>
              )}
              <span className="sr-only" aria-live="polite" aria-atomic="true">
                Strana {Math.min(page + 1, pages.length)} z {pages.length}
              </span>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm leading-6 text-neutral-600">
              {copy.fallback}
            </p>
          )}
        </div>
      </Container>
      {selected && !preview && (
        <Dialog
          title={`@${INSTAGRAM_USERNAME}`}
          onClose={() => setSelectedId(null)}
          className="instagram-post-dialog max-w-[640px] rounded-none bg-white p-0 text-neutral-950 sm:p-0"
        >
          <InstagramThumbnail key={selected.id} post={selected} />
          <div className="p-5">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {selected.caption}
            </p>
            <time
              dateTime={selected.publishedAt}
              className="mt-4 block text-xs text-neutral-600"
            >
              {new Date(selected.publishedAt).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Prague",
              })}
            </time>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <a
                href={selected.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
              >
                Otevřít na Instagramu
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="instagram-dialog-arrow"
                  aria-label="Předchozí příspěvek"
                  disabled={selectedIndex <= 0}
                  onClick={() =>
                    setSelectedId(visiblePosts[selectedIndex - 1]!.id)
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="instagram-dialog-arrow"
                  aria-label="Další příspěvek"
                  disabled={selectedIndex >= visiblePosts.length - 1}
                  onClick={() =>
                    setSelectedId(visiblePosts[selectedIndex + 1]!.id)
                  }
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
