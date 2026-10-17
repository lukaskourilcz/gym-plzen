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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-.01em]">
          {title}
          {detail && (
            <span className="ml-2 text-base font-normal tracking-normal text-muted-foreground sm:text-lg">
              | {detail}
            </span>
          )}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
