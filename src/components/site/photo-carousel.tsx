"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GymPhoto } from "@/lib/data/gym-photos";

/**
 * Auto-advancing photo carousel (arrows + dots, pauses on hover). Used on the
 * booking page to sell the space next to the calendar. Size it from the
 * caller via `className` (aspect-ratio or height).
 *
 * `unoptimized` is set because the current placeholders are SVG scenes, which
 * the Next image optimizer refuses; remove it once real photos (JPG/WebP)
 * replace them in src/lib/data/gym-photos.ts.
 */
export function PhotoCarousel({ photos, className }: { photos: GymPhoto[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = photos.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [paused, count]);

  if (count === 0) return null;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Fotografie gymu"
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border bg-ink shadow-lg",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Sliding track */}
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((photo, i) => (
          <div key={photo.src} className="relative h-full w-full shrink-0">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              unoptimized
              priority={i === 0}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-x-5 bottom-12 text-white">
              <div className="text-lg font-bold drop-shadow">{photo.label}</div>
              {photo.note && <div className="text-sm text-white/75">{photo.note}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button
        type="button"
        aria-label="Předchozí fotka"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Další fotka"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Fotka ${i + 1} z ${count}`}
            aria-current={i === index}
            onClick={() => go(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index ? "w-6 bg-primary" : "w-2 bg-white/45 hover:bg-white/70",
            )}
          />
        ))}
      </div>
    </div>
  );
}
