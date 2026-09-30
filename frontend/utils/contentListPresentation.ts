export function splitFeatured<T>(items: readonly T[], page: number, enabled: boolean): { featured: T | null; rows: readonly T[] } {
  return enabled && page === 1 && items.length
    ? { featured: items[0], rows: items.slice(1) }
    : { featured: null, rows: items }
}
