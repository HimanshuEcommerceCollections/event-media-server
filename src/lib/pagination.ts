/**
 * Page/pageSize parsing shared by every admin list endpoint.
 *
 * Takes a `req.query`-shaped value (or its already-validated counterpart) and
 * clamps whatever is in it to sane bounds rather than trusting the caller's
 * numbers, so a bad or missing value degrades to a default instead of a query
 * with a negative LIMIT or an unbounded one.
 */

export type PageQuery = { page: number; pageSize: number; offset: number };

function toInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.floor(value) : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parsePageQuery(
  query: unknown,
  opts?: { defaultSize?: number; maxSize?: number },
): PageQuery {
  const defaultSize = opts?.defaultSize ?? 20;
  const maxSize = opts?.maxSize ?? 100;
  const source = (query ?? {}) as Record<string, unknown>;

  const rawPage = toInt(source.page);
  const page = rawPage === null || rawPage < 1 ? 1 : rawPage;

  const rawSize = toInt(source.pageSize);
  let pageSize = rawSize === null ? defaultSize : rawSize;
  if (pageSize < 1) pageSize = 1;
  if (pageSize > maxSize) pageSize = maxSize;

  return { page, pageSize, offset: (page - 1) * pageSize };
}
