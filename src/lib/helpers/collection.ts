/** Small array/collection helpers. */

/** Group items by a string key derived from each item. */
export function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

/** Sum a numeric field across items. */
export function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}
