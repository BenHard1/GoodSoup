import Link from "next/link";
import { filtersHref, type Filters } from "../search-params";

export function Pagination({
  base,
  filters,
  hasMore,
  extra = {},
}: {
  base: string;
  filters: Filters;
  hasMore: boolean;
  extra?: Record<string, string>;
}) {
  if (filters.page === 1 && !hasMore) return null;
  const href = (page: number) => filtersHref(base, { ...extra, ...filters, page });
  const cls =
    "inline-flex min-h-11 items-center rounded-full border border-line bg-white px-5 font-semibold hover:bg-cream";
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
      {filters.page > 1 ? (
        <Link href={href(filters.page - 1)} className={cls} rel="prev">
          Précédent
        </Link>
      ) : null}
      <span className="text-sm text-ink-soft">Page {filters.page}</span>
      {hasMore ? (
        <Link href={href(filters.page + 1)} className={cls} rel="next">
          Suivant
        </Link>
      ) : null}
    </nav>
  );
}
