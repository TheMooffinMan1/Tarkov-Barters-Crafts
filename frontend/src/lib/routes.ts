export const paths = {
  profit: "/",
  consumables: "/fuel-filters",
  items: "/items",
  item: (slug: string) => `/items/${encodeURIComponent(slug)}`,
} as const;

export function isItemsPath(pathname: string) {
  return pathname === paths.items || pathname.startsWith(`${paths.items}/`);
}

export function isConsumablesPath(pathname: string) {
  return pathname === paths.consumables;
}

export function slugFromPath(pathname: string) {
  const prefix = `${paths.items}/`;
  if (!pathname.startsWith(prefix)) return "";
  const raw = pathname.slice(prefix.length).split("/")[0];
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
