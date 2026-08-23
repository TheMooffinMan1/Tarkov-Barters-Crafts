import { asArray, titleCaseNormalized } from "./util.mjs";

const ROOT_ITEM_CATEGORY_ID = "54009119af1c881c07000029";
const ANY_ITEM_MIN_COUNT = 200;
const CATEGORY_COVERAGE = 0.4;

function entryId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

export function objectiveItemIds(objective) {
  if (!objective) return [];
  const raw = objective.type === "useItem" ? asArray(objective.useAny) : asArray(objective.items);
  return raw.map(entryId).filter(Boolean);
}

function isRootCategory(category) {
  if (!category) return true;
  return category.id === ROOT_ITEM_CATEGORY_ID || category.normalizedName === "item";
}

function categoryLabel(category) {
  const name = String(category.name || "").trim();
  const looksTranslated =
    name && !/^[0-9a-f]{24}/i.test(name) && !/\sname$/i.test(name) && name !== category.id;
  if (looksTranslated) return name;
  return titleCaseNormalized(category.normalizedName || "") || name;
}

export function buildCategoryIndex(rawItems, rawCategories) {
  const categoryById = new Map();
  for (const raw of asArray(rawCategories)) {
    if (!raw?.id) continue;
    categoryById.set(raw.id, {
      id: raw.id,
      name: raw.name || "",
      normalizedName: raw.normalizedName || "",
    });
  }

  const categoriesByItem = new Map();
  const sizeByCategory = new Map();
  for (const raw of Object.values(rawItems || {})) {
    const ids = asArray(raw?.categories).map(entryId).filter(Boolean);
    if (raw?.id && ids.length) categoriesByItem.set(raw.id, ids);
    for (const id of ids) sizeByCategory.set(id, (sizeByCategory.get(id) || 0) + 1);
  }

  return { categoryById, categoriesByItem, sizeByCategory };
}

export function classifyQuestItems(itemIds, index) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (ids.length <= 1) return { kind: "specific" };

  let common = null;
  for (const id of ids) {
    const cats = index.categoriesByItem.get(id);
    if (!cats?.length) continue;
    if (!common) common = new Set(cats);
    else {
      for (const catId of [...common]) {
        if (!cats.includes(catId)) common.delete(catId);
      }
    }
  }

  const ranked = [...(common || [])]
    .map((id) => ({
      id,
      size: index.sizeByCategory.get(id) || 0,
      category: index.categoryById.get(id),
    }))
    .filter((row) => row.category && !isRootCategory(row.category))
    .sort((a, b) => a.size - b.size || a.id.localeCompare(b.id));

  const best = ranked[0];
  if (!best || isRootCategory(best.category)) {
    if (ids.length >= ANY_ITEM_MIN_COUNT) return { kind: "any" };
    return { kind: "specific" };
  }

  if (best.size > 0 && ids.length / best.size >= CATEGORY_COVERAGE) {
    return { kind: "category", categoryName: categoryLabel(best.category) };
  }
  return { kind: "specific" };
}
