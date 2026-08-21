import { deepTranslate, translateLookup, unwrap } from "../compute/util.mjs";

export const GAME_MODE_IDS = ["regular", "pve", "pvp-season"];

export function userAgent() {
  const repo = process.env.REPO_URL || "https://github.com/tarkov-barters-crafts";
  return `TarkovBartersCrafts/1.0 (${repo}; profit tracker)`;
}

export function originBase() {
  return (process.env.UPSTREAM_BASE || "https://json.tarkov.dev").replace(/\/$/, "");
}

export async function fetchJson(path, { etag, method = "GET" } = {}) {
  const url = path.startsWith("http") ? path : `${originBase()}${path}`;
  const headers = {
    "User-Agent": userAgent(),
    Accept: "application/json",
    "Accept-Encoding": "gzip",
  };
  if (etag) headers["If-None-Match"] = etag;
  const response = await fetch(url, { method, headers });
  if (response.status === 304) {
    return { status: 304, etag: etag || response.headers.get("etag") };
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`upstream ${response.status} ${method} ${url}`);
  }
  const json = method === "HEAD" ? null : await response.json();
  return {
    status: response.status,
    etag: response.headers.get("etag"),
    json,
  };
}

async function fetchTranslated(path) {
  const [main, en] = await Promise.all([fetchJson(path), fetchJson(`${path}_en`).catch(() => ({ json: { data: {} } }))]);
  const translated = deepTranslate(unwrap(main.json), translateLookup(en.json));
  return { etag: main.etag, data: translated };
}

/**
 * Three bulk documents plus the small name tables. Never per-item.
 * If items returns 304, skip the rest of this mode.
 */
export async function fetchMode(mode, previousItemsEtag) {
  const items = await fetchJson(`/${mode}/items`, { etag: previousItemsEtag });
  if (items.status === 304) {
    return { changed: false, itemsEtag: items.etag };
  }

  const [itemsEn, crafts, barters, traders, hideout, tasks] = await Promise.all([
    fetchJson(`/${mode}/items_en`).catch(() => ({ json: { data: {} } })),
    fetchJson(`/${mode}/crafts`),
    fetchJson(`/${mode}/barters`),
    fetchTranslated(`/${mode}/traders`),
    fetchTranslated(`/${mode}/hideout`),
    fetchTranslated(`/${mode}/tasks`),
  ]);

  return {
    changed: true,
    itemsEtag: items.etag,
    payload: {
      items: items.json,
      itemLocale: translateLookup(itemsEn.json),
      crafts: crafts.json,
      barters: barters.json,
      traders: traders.data,
      hideout: hideout.data,
      tasks: tasks.data,
    },
  };
}
