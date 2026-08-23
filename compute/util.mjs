export const BITCOIN_FARM_ID = "5d494a445b56502f18c98a10";
export const MIN_CRAFT_SECONDS = 5;
export const CRAFTING_REDUCTION_PER_LEVEL = 0.75;

/** Base generator: 1 fuel resource lasts 12m 38s (wiki). Solar doubles this. */
export const FUEL_SECONDS_PER_UNIT = 758;
/** Hideout Management: −0.5% fuel/filter consumption per level (−25% at 50 / elite). */
export const HIDEOUT_CONSUMPTION_REDUCTION_PER_LEVEL = 0.5;

export const METAL_FUEL_ID = "5d1b36a186f7742523398433";
export const EXPEDITIONARY_FUEL_ID = "5d1b371186f774253763a656";
export const WATER_FILTER_ID = "5d1b385e86f774252167b98a";
export const AIR_FILTER_ID = "5d1b2f3f86f774252167a52c";
export const PHYSICAL_BITCOIN_ID = "59faff1d86f7746c51718c9c";

export const FUEL_ITEM_IDS = [METAL_FUEL_ID, EXPEDITIONARY_FUEL_ID];
export const FILTER_ITEM_IDS = [WATER_FILTER_ID, AIR_FILTER_ID];

/** Base bitcoin farm craft time (seconds) at 1 GPU; rate scales with cards. */
export const BITCOIN_BASE_SECONDS = 300000;
export const BITCOIN_GPU_BONUS = 0.041225;

const CONSUMABLE_BY_ID = {
  [METAL_FUEL_ID]: "fuel",
  [EXPEDITIONARY_FUEL_ID]: "fuel",
  [WATER_FILTER_ID]: "waterFilter",
  [AIR_FILTER_ID]: "airFilter",
};

export function consumableKind(itemId) {
  return CONSUMABLE_BY_ID[itemId] || null;
}

/** Multiplier on fuel/filter usage (1 at HM 0, 0.75 at HM 50). */
export function hideoutConsumptionMultiplier(hideoutManagement) {
  const level = Math.max(0, Math.min(50, Number(hideoutManagement) || 0));
  return 1 - (level * HIDEOUT_CONSUMPTION_REDUCTION_PER_LEVEL) / 100;
}

/** Seconds to produce one Physical Bitcoin for the given GPU count. */
export function bitcoinSecondsPerCoin(gpus) {
  const gc = Math.max(1, Math.min(50, Math.floor(Number(gpus) || 1)));
  return BITCOIN_BASE_SECONDS / (1 + (gc - 1) * BITCOIN_GPU_BONUS);
}

export function bitcoinPerHour(gpus) {
  const seconds = bitcoinSecondsPerCoin(gpus);
  return seconds > 0 ? 3600 / seconds : 0;
}

export function unwrap(doc) {
  if (doc && typeof doc === "object" && "data" in doc) return doc.data;
  return doc;
}

export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
}

export function asMap(value) {
  if (!value) return {};
  if (Array.isArray(value)) {
    const map = {};
    for (const row of value) {
      if (row?.id) map[row.id] = row;
    }
    return map;
  }
  return value;
}

export function itemsDocument(itemsInput) {
  const data = unwrap(itemsInput) ?? {};
  if (data.items && typeof data.items === "object") return data;
  return { items: data, fleaMarket: data.fleaMarket ?? {} };
}

export function tasksMap(tasksInput) {
  const data = unwrap(tasksInput) ?? {};
  if (data.tasks) return asMap(data.tasks);
  return asMap(data);
}

export function translateLookup(enDoc) {
  const data = unwrap(enDoc);
  return data && typeof data === "object" ? data : {};
}

/** Replace localisation keys using a `{ key: english }` map. */
export function deepTranslate(node, enMap) {
  if (!enMap || typeof node === "undefined") return node;
  if (typeof node === "string") return enMap[node] ?? node;
  if (Array.isArray(node)) return node.map((child) => deepTranslate(child, enMap));
  if (node && typeof node === "object") {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = deepTranslate(value, enMap);
    }
    return out;
  }
  return node;
}

export function isTool(attributes) {
  if (!attributes) return false;
  if (attributes.tool === true || attributes.tool === "true") return true;
  return false;
}

export function unique(ids) {
  return [...new Set(ids.filter(Boolean))];
}

export function titleCaseNormalized(name) {
  if (!name) return "";
  return String(name)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function itemSlugBase(shortName, id) {
  const base = String(shortName || id)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || id;
}

/** Assign URL slugs from shortName; duplicate short names get a six-character id suffix. */
export function assignItemSlugs(itemMap) {
  const buckets = new Map();
  for (const item of Object.values(itemMap)) {
    const base = itemSlugBase(item.shortName, item.id);
    if (!buckets.has(base)) buckets.set(base, []);
    buckets.get(base).push(item);
  }
  const itemSlugs = {};
  for (const [base, items] of buckets) {
    if (items.length === 1) {
      items[0].slug = base;
      itemSlugs[base] = items[0].id;
      continue;
    }
    for (const item of items) {
      const slug = `${base}-${item.id.slice(-6)}`;
      item.slug = slug;
      itemSlugs[slug] = item.id;
    }
  }
  return itemSlugs;
}

export function resolveItemId(blob, slugOrId) {
  if (!slugOrId || !blob) return "";
  if (blob.itemSlugs?.[slugOrId]) return blob.itemSlugs[slugOrId];
  if (blob.items?.[slugOrId]) return slugOrId;
  return "";
}
