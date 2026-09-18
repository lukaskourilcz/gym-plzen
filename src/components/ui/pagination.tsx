import { Button } from "@/components/ui/button";

/**
 * Previous / next pagination for a list read one page at a time.
 *
 * `hasNext` comes from reading one row more than the page size, which is why
 * there is no total: a count query over a growing log would be paid on every
 * render to print a number nobody acts on. A single page renders nothing.
 */
export function Pagination({
  page,
  hasNext,
  hrefForPage,
  label,
  className,
}: {
  /** One-based, already clamped by the page that read the rows. */
  page: number;
  hasNext: boolean;
  hrefForPage: (page: number) => string;
  /** Names what is being paged: a page may hold more than one list. */
  label: string;
  className?: string;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav
      aria-label={label}
      className={className ?? "mt-6 flex flex-wrap items-center gap-4"}
    >
      {page > 1 ? (
        <Button href={hrefForPage(page - 1)} variant="outline">
          Předchozí
        </Button>
      ) : null}
      <span className="text-sm">Strana {page}</span>
      {hasNext ? (
        <Button href={hrefForPage(page + 1)} variant="outline">
          Další
        </Button>
      ) : null}
    </nav>
  );
}
