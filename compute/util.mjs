export const BITCOIN_FARM_ID = "5d494a445b56502f18c98a10";
export const MIN_CRAFT_SECONDS = 5;
export const CRAFTING_REDUCTION_PER_LEVEL = 0.75;

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
