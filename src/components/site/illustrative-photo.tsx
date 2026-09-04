import Image from "next/image";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {illustrative && (
        <span className="group absolute bottom-0 right-0">
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
            className="pointer-events-none absolute bottom-full right-2 mb-1 whitespace-nowrap rounded-sm bg-ink/95 px-2 py-1 text-xs font-bold text-ink-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
          >
            Ilustrační foto
          </span>
        </span>
      )}
    </div>
  );
}
