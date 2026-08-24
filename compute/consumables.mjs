import { DEFAULT_SETTINGS } from "./settings.mjs";
import {
  FUEL_ITEM_IDS,
  WATER_FILTER_ID,
  AIR_FILTER_ID,
  consumableKind,
} from "./util.mjs";
import { fleaBuyPrice, itemOf } from "./pricing.mjs";

const CONSUMABLE_ITEM_IDS = [...FUEL_ITEM_IDS, WATER_FILTER_ID, AIR_FILTER_ID];

function minPositive(pairs) {
  const live = pairs.filter(([price]) => price > 0);
  if (!live.length) return { price: 0, source: "none" };
  live.sort((a, b) => a[0] - b[0]);
  return { price: live[0][0], source: live[0][1] };
}

function traderBuyPrice(item, settings) {
  if (!item) return 0;
  let best = 0;
  for (const offer of item.buyFromTrader || []) {
    if (settings.filterToProgress) {
      const loyalty = settings.traderLevels[offer.traderId] ?? 0;
      if (loyalty < offer.minTraderLevel) continue;
    }
    if (offer.taskUnlock && settings.hiddenQuestIds.includes(offer.taskUnlock)) continue;
    if (!best || offer.priceRUB < best) best = offer.priceRUB;
  }
  return best;
}

function buyOnlyPrice(id, settings, blob) {
  const item = itemOf(blob, id);
  const flea = fleaBuyPrice(item, settings, blob);
  const trader = traderBuyPrice(item, settings);
  return minPositive([
    [flea, "flea"],
    [trader, "trader"],
  ]);
}

function recipeHidden(taskUnlock, settings) {
  return Boolean(taskUnlock && settings.hiddenQuestIds.includes(taskUnlock));
}

function barterAvailable(barter, settings, blob) {
  if (recipeHidden(barter.taskUnlock, settings)) return false;
  if (settings.filterToProgress) {
    const loyalty = settings.traderLevels[barter.traderId] ?? 0;
    if (loyalty < barter.minTraderLevel) return false;
  }
  return true;
}

function indexByOutput(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row.output?.id;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

function nameHay(parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function taskName(blob, id) {
  if (!id) return null;
  for (const row of blob.unlockTasks || []) {
    if (row.id === id) return row.name || id;
  }
  return id;
}

function unitsPerOutput(item) {
  const kind = consumableKind(item?.id);
  if (kind === "fuel") return Number(item?.resourceUnits) || 100;
  return 1;
}

function pricePerUnit(totalCost, outputCount, unitsPerItem) {
  const units = (Number(outputCount) || 1) * unitsPerItem;
  return units > 0 ? totalCost / units : totalCost;
}

function makeBuyRow(item, settings, blob, source, price, traderOffer) {
  const kind = consumableKind(item.id);
  if (!kind) return null;
  const units = unitsPerOutput(item);
  const traderName = traderOffer
    ? blob.meta.traders[traderOffer.traderId]?.name || traderOffer.traderId
    : null;
  const methodLabel =
    source === "flea"
      ? "Flea buy"
      : `${traderName} LL${traderOffer?.minTraderLevel || 1}`;

  return {
    id: traderOffer
      ? `buy:${item.id}:${traderOffer.traderId}:${traderOffer.minTraderLevel}`
      : `buy:${item.id}:flea`,
    consumableKind: kind,
    method: source,
    methodLabel,
    itemId: item.id,
    itemName: item.name,
    itemShortName: item.shortName,
    iconLink: item.iconLink,
    resourceUnits: units,
    outputCount: 1,
    totalCost: price,
    pricePerUnit: pricePerUnit(price, 1, units),
    costItems: [
      {
        id: item.id,
        count: 1,
        tool: false,
        name: item.name,
        shortName: item.shortName,
        iconLink: item.iconLink,
        unit: price,
        source,
        cost: price,
      },
    ],
    traderId: traderOffer?.traderId,
    traderName,
    level: traderOffer?.minTraderLevel || 0,
    taskUnlock: traderOffer?.taskUnlock || null,
    taskName: taskName(blob, traderOffer?.taskUnlock),
    buyLimit: traderOffer?.buyLimit ?? null,
    search: nameHay([item.name, item.shortName, methodLabel, traderName]),
  };
}

function makeBarterRow(barter, blob, settings) {
  const outputItem = itemOf(blob, barter.output.id);
  if (!outputItem) return null;
  const kind = consumableKind(outputItem.id);
  if (!kind) return null;

  const lines = [];
  let total = 0;
  for (const input of barter.inputs || []) {
    if (input.tool && !settings.countToolsAsCost) continue;
    const inputItem = itemOf(blob, input.id);
    const priced = buyOnlyPrice(input.id, settings, blob);
    const qty = Number(input.count) || 0;
    const lineCost = priced.price * qty;
    total += lineCost;
    lines.push({
      id: input.id,
      count: qty,
      tool: Boolean(input.tool),
      name: inputItem?.name || input.id,
      shortName: inputItem?.shortName || input.id,
      iconLink: inputItem?.iconLink,
      unit: priced.price,
      source: priced.source,
      cost: lineCost,
    });
  }

  const traderName = blob.meta.traders[barter.traderId]?.name || barter.traderId;
  const outputCount = barter.output?.count || 1;
  const units = unitsPerOutput(outputItem);

  return {
    id: `barter:${barter.id}`,
    consumableKind: kind,
    method: "barter",
    methodLabel: `${traderName} LL${barter.minTraderLevel} barter`,
    itemId: outputItem.id,
    itemName: outputItem.name,
    itemShortName: outputItem.shortName,
    iconLink: outputItem.iconLink,
    resourceUnits: units,
    outputCount,
    totalCost: total,
    pricePerUnit: pricePerUnit(total, outputCount, units),
    costItems: lines,
    traderId: barter.traderId,
    traderName,
    level: barter.minTraderLevel,
    taskUnlock: barter.taskUnlock,
    taskName: taskName(blob, barter.taskUnlock),
    buyLimit: barter.buyLimit,
    search: nameHay([
      outputItem.name,
      outputItem.shortName,
      traderName,
      taskName(blob, barter.taskUnlock),
      ...lines.map((line) => line.name),
    ]),
  };
}

function markCheapest(rows) {
  if (!rows.length) return rows;
  const best = Math.min(...rows.map((row) => row.pricePerUnit));
  return rows.map((row) => ({ ...row, cheapest: row.pricePerUnit === best }));
}

/** Rank every way to buy fuel tanks / filters by cost per fuel unit or per filter. */
export function valuateConsumables(blob, userSettings = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...userSettings };
  const bartersByOutput = indexByOutput(blob.barters);
  const fuel = [];
  const filters = [];

  for (const itemId of CONSUMABLE_ITEM_IDS) {
    const item = itemOf(blob, itemId);
    if (!item) continue;
    const kind = consumableKind(itemId);
    if (!kind) continue;

    const flea = fleaBuyPrice(item, settings, blob);
    if (flea > 0) {
      const row = makeBuyRow(item, settings, blob, "flea", flea);
      if (row) (kind === "fuel" ? fuel : filters).push(row);
    }

    for (const offer of item.buyFromTrader || []) {
      if (settings.filterToProgress) {
        const loyalty = settings.traderLevels[offer.traderId] ?? 0;
        if (loyalty < offer.minTraderLevel) continue;
      }
      if (offer.taskUnlock && settings.hiddenQuestIds.includes(offer.taskUnlock)) continue;
      if (offer.priceRUB <= 0) continue;
      const row = makeBuyRow(item, settings, blob, "trader", offer.priceRUB, offer);
      if (row) (kind === "fuel" ? fuel : filters).push(row);
    }

    for (const barter of bartersByOutput.get(itemId) || []) {
      if (!barterAvailable(barter, settings, blob)) continue;
      if (settings.traderFilter && barter.traderId !== settings.traderFilter) continue;
      if (settings.traderLevelFilter && barter.minTraderLevel !== settings.traderLevelFilter) continue;
      const row = makeBarterRow(barter, blob, settings);
      if (row && row.totalCost > 0) (kind === "fuel" ? fuel : filters).push(row);
    }
  }

  fuel.sort((a, b) => a.pricePerUnit - b.pricePerUnit || a.totalCost - b.totalCost);
  filters.sort((a, b) => a.pricePerUnit - b.pricePerUnit || a.totalCost - b.totalCost);

  return {
    fuel: markCheapest(fuel),
    filters: markCheapest(filters),
  };
}
