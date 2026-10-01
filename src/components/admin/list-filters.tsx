import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  adminPageHref,
  type AdminFilterKey,
  type AdminFilters,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { Pagination } from "@/components/ui/pagination";

export interface AdminSelectFilter {
  name: AdminFilterKey;
  label: string;
  options: { value: string; label: string }[];
}

export function AdminListPagination({
  path,
  params,
  page,
  hasNext,
  pageKey = "page",
  label = "Stránkování",
}: {
  path: string;
  params: AdminSearchParams;
  page: number;
  hasNext: boolean;
  pageKey?: string;
  label?: string;
}) {
  return (
    <Pagination
      page={page}
      hasNext={hasNext}
      hrefForPage={(next) => adminPageHref(path, params, next, pageKey)}
      label={label}
    />
  );
}

/** A GET form resets pagination and keeps filters shareable and keyboard usable. */
export function AdminListFilters({
  path,
  filters,
  selects = [],
  searchLabel = "Hledat",
  placeholder = "Jméno nebo e-mail",
  dateLabel = "Datum",
  hidden = {},
}: {
  path: string;
  filters: AdminFilters;
  selects?: AdminSelectFilter[];
  searchLabel?: string;
  placeholder?: string;
  dateLabel?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={path}
      method="get"
      aria-label="Filtry"
      className="mb-5 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="grid gap-1 text-sm font-semibold">
          {searchLabel}
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder={placeholder}
            maxLength={200}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {dateLabel} od
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {dateLabel} do
          <Input type="date" name="to" defaultValue={filters.to} />
        </label>
        {selects.map((filter) => (
          <label key={filter.name} className="grid gap-1 text-sm font-semibold">
            {filter.label}
            <Select
              name={filter.name}
              defaultValue={filters[filter.name]}
              className="min-h-11"
            >
              <option value="">Vše</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Filtrovat</Button>
          <Button href={path} variant="outline">
            Zrušit filtry
          </Button>
        </div>
      </div>
      {filters.invalidDates ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Zadejte platné období; datum od nesmí být po datu do.
        </p>
      ) : null}
    </form>
  );
}
