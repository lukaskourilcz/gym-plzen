import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A photograph on the public site, with an honest label while the pictures are
 * stock stand-ins rather than the gym itself.
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
        <span className="absolute bottom-2 right-2 rounded-sm bg-ink/85 px-2 py-1 text-xs font-bold text-ink-foreground">
          Ilustrační foto
        </span>
      )}
    </div>
  );
}
