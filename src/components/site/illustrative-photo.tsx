import Image from "next/image";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Text on compact screens; an interactive tooltip once there is room for it. */
function IllustrativePhotoMarker({ illustrative }: { illustrative: boolean }) {
  if (!illustrative) return null;

  return (
    <span
      data-illustrative-photo-marker
      className="absolute bottom-0 right-0 z-10"
    >
      <span
        data-illustrative-photo-mobile-label
        className="mb-2 mr-2 block rounded-md border border-white/20 bg-ink/90 px-3 py-2 text-xs font-bold text-ink-foreground shadow-sm lg:hidden"
      >
        Ilustrační foto
      </span>
      <span className="group hidden lg:flex">
        <button
          type="button"
          aria-label="Ilustrační foto"
          className="grid size-11 place-items-center text-ink-foreground"
        >
          <span className="grid size-7 place-items-center rounded-full border border-white/45 bg-ink/85 shadow-sm">
            <Info aria-hidden="true" className="size-4" />
          </span>
        </button>
        <span
          role="tooltip"
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full right-1 mb-2 origin-bottom-right translate-y-1 scale-95 whitespace-nowrap rounded-md border border-white/15 bg-ink px-3 py-2 text-xs font-bold text-ink-foreground opacity-0 shadow-md transition-[opacity,transform] duration-150 ease-brand group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 motion-reduce:transition-none"
        >
          Ilustrační foto
          <span
            aria-hidden="true"
            className="absolute -bottom-1 right-3 size-2 rotate-45 border-b border-r border-white/15 bg-ink"
          />
        </span>
      </span>
    </span>
  );
}

/**
 * A photograph on the public site, with an honest information marker while the
 * pictures are stand-ins rather than the gym itself.
 *
 * The label is a statement of fact, not decoration: until the client supplies
 * their own photographs, a visitor must not be led to believe these images show
 * the space they are booking.
 */
export function IllustrativePhoto({
  src,
  alt,
  sizes,
  priority = false,
  illustrative,
  className,
  children,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  illustrative: boolean;
  className?: string;
  /** Rendered when there is no photograph yet. */
  children?: React.ReactNode;
}) {
  if (!src) return <>{children}</>;

  return (
    <div
      data-illustrative-photo={illustrative ? "true" : undefined}
      className={cn("relative overflow-hidden", className)}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      <IllustrativePhotoMarker illustrative={illustrative} />
    </div>
  );
}
