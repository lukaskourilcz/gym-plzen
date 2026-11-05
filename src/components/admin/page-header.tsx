/** Consistent admin page heading (title + optional description). */
export function PageHeader({
  title,
  detail,
  description,
  children,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-.03em]">
          {title}
          {detail ? " " : null}
          {detail && (
            <span className="mt-2 block text-sm font-normal tracking-normal text-muted-foreground sm:mt-0 sm:ml-3 sm:inline-block">
              {detail}
            </span>
          )}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
