import {
  BITCOIN_FARM_ID,
  asArray,
  asMap,
  itemsDocument,
  tasksMap,
  unique,
  isTool,
  titleCaseNormalized,
} from "./util.mjs";

function contained(entry) {
  if (!entry) return null;
  const id = typeof entry.item === "string" ? entry.item : entry.item?.id;
  if (!id) return null;
  return {
    id,
    count: Number(entry.count ?? entry.quantity ?? 1) || 1,
    tool: isTool(entry.attributes),
  };
}

function itemUsesDurability(raw, types) {
  if (types.includes("gun") || types.includes("keys") || types.includes("preset")) return true;
  if ((Number(raw.maxDurability) || 0) > 0) return true;
  const props = raw.properties || {};
  if ((Number(props.uses) || 0) > 1) return true;
  if ((Number(props.units) || 0) > 1) return true;
  if ((Number(props.hitpoints) || 0) > 0) return true;
  return false;
}

function slimItem(raw, locale = {}) {
  if (!raw) return null;
  const id = raw.id;
  if (!id) return null;
  const types = Array.isArray(raw.types) ? raw.types : [];
  const name = (locale[raw.name] ?? raw.name) || id;
  return {
    id,
    name,
    shortName: (locale[raw.shortName] ?? raw.shortName) || name,
    iconLink: raw.iconLink || `https://assets.tarkov.dev/${id}-icon.webp`,
    basePrice: Number(raw.basePrice) || 0,
    lastLowPrice: Number(raw.lastLowPrice) || 0,
    avg24hPrice: Number(raw.avg24hPrice) || 0,
    noFlea: types.includes("noFlea") || raw.noFlea === true,
    usesDurability: itemUsesDurability(raw, types),
    minLevelForFlea: Number(raw.minLevelForFlea) || 0,
    buyFromTrader: slimOffers(raw.buyFromTrader),
    sellToTrader: slimOffers(raw.sellToTrader),
  };
}

function taskId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function slimOffers(offers) {
  return asArray(offers)
    .map((offer) => ({
      traderId: offer.trader || offer.traderId || offer.vendor?.trader?.id || "",
      priceRUB: Number(offer.priceRUB ?? offer.price) || 0,
      minTraderLevel: Number(offer.minTraderLevel) || 1,
      taskUnlock: taskId(offer.taskUnlock),
      buyLimit: offer.buyLimit ?? null,
    }))
    .filter((offer) => offer.traderId && offer.priceRUB > 0);
}

function collectRecipeItemIds(crafts, barters) {
  const ids = [];
  for (const craft of crafts) {
    for (const row of craft.inputs) ids.push(row.id);
    if (craft.output) ids.push(craft.output.id);
    for (const qid of craft.requiredQuestItems) ids.push(qid);
  }
  for (const barter of barters) {
    for (const row of barter.inputs) ids.push(row.id);
    if (barter.output) ids.push(barter.output.id);
  }
  return unique(ids);
}

function normalizeCraft(raw) {
  const stationId = typeof raw.station === "string" ? raw.station : raw.station?.id;
  const output = contained(raw.productItem || raw.rewardItems?.[0]);
  const inputs = asArray(raw.requiredItems).map(contained).filter(Boolean);
  if (!raw.id || !stationId || !output) return null;
  if (stationId === BITCOIN_FARM_ID) return null;
  if (inputs.length === 0) return null;
  return {
    id: raw.id,
    stationId,
    level: Number(raw.level) || 1,
    duration: Number(raw.duration) || 0,
    taskUnlock: taskId(raw.taskUnlock),
    gameEditions: asArray(raw.gameEditions),
    requiredQuestItems: asArray(raw.requiredQuestItems)
      .map((row) => (typeof row === "string" ? row : row.item || row.id))
      .filter(Boolean),
    inputs,
    output,
  };
}

function normalizeBarter(raw) {
  const traderId = typeof raw.trader === "string" ? raw.trader : raw.trader?.id;
  const output = contained(raw.offeredItem || raw.rewardItems?.[0]);
  const inputs = asArray(raw.requiredItems).map(contained).filter(Boolean);
  if (!raw.id || !traderId || !output || inputs.length === 0) return null;
  return {
    id: raw.id,
    traderId,
    minTraderLevel: Number(raw.minTraderLevel ?? raw.level) || 1,
    taskUnlock: taskId(raw.taskUnlock),
    buyLimit: raw.buyLimit ?? null,
    restockAmount: raw.restockAmount ?? null,
    inputs,
    output,
  };
}

function metaFrom(itemDoc, traders, hideout, crafts, barters, itemMap) {
  const flea = itemDoc.fleaMarket || {};
  const usedTraderIds = new Set(barters.map((row) => row.traderId));
  for (const item of Object.values(itemMap)) {
    for (const offer of item.buyFromTrader || []) usedTraderIds.add(offer.traderId);
    for (const offer of item.sellToTrader || []) usedTraderIds.add(offer.traderId);
  }
  const traderMap = {};
  for (const [id, trader] of Object.entries(asMap(traders))) {
    if (!usedTraderIds.has(id)) continue;
    traderMap[id] = {
      id,
      name: trader.name || titleCaseNormalized(trader.normalizedName) || id,
      normalizedName: trader.normalizedName || id,
      levels: asArray(trader.levels).map((row) => ({
        level: Number(row.level) || 0,
        requiredPlayerLevel: Number(row.requiredPlayerLevel) || 0,
      })),
    };
  }

  const usedStations = new Set(crafts.map((c) => c.stationId));
  const stationMap = {};
  for (const [id, station] of Object.entries(asMap(hideout))) {
    if (!usedStations.has(id) && station.normalizedName !== "intelligence-center") continue;
    stationMap[id] = {
      id,
      name: station.name || titleCaseNormalized(station.normalizedName) || id,
      normalizedName: station.normalizedName || id,
      maxLevel: Array.isArray(station.levels) ? station.levels.length : 3,
    };
  }
  for (const id of usedStations) {
    if (stationMap[id]) continue;
    stationMap[id] = { id, name: id, normalizedName: id, maxLevel: 3 };
  }

  let intelligenceCenterId = Object.values(stationMap).find((s) => s.normalizedName === "intelligence-center")?.id || null;

  return {
    flea: {
      enabled: flea.enabled !== false,
      minPlayerLevel: Number(flea.minPlayerLevel) || 15,
      sellOfferFeeRate: Number(flea.sellOfferFeeRate) || 0.03,
      sellRequirementFeeRate: Number(flea.sellRequirementFeeRate) || 0.03,
      name: flea.name === "FleaMarket" ? "Flea Market" : flea.name || "Flea Market",
    },
    stations: stationMap,
    traders: traderMap,
    intelligenceCenterId,
  };
}

function buildFlips(itemMap) {
  const flips = [];
  for (const item of Object.values(itemMap)) {
    for (const offer of item.buyFromTrader || []) {
      flips.push({
        id: `${item.id}:${offer.traderId}:${offer.minTraderLevel}`,
        itemId: item.id,
        traderId: offer.traderId,
        minTraderLevel: offer.minTraderLevel,
        taskUnlock: taskId(offer.taskUnlock),
        buyPriceRUB: offer.priceRUB,
        buyLimit: offer.buyLimit,
      });
    }
  }
  return flips;
}

function collectUnlockTaskIds(crafts, barters, flips, itemMap) {
  const ids = [];
  for (const row of crafts) if (row.taskUnlock) ids.push(row.taskUnlock);
  for (const row of barters) if (row.taskUnlock) ids.push(row.taskUnlock);
  for (const row of flips) if (row.taskUnlock) ids.push(row.taskUnlock);
  for (const item of Object.values(itemMap)) {
    for (const offer of item.buyFromTrader || []) {
      if (offer.taskUnlock) ids.push(offer.taskUnlock);
    }
  }
  return unique(ids);
}

/**
 * Slim the upstream dumps into the blob the UI valuates.
 * No fetch, no env, no Cloudflare/GitHub APIs.
 */
export function buildProfitBlob({ items, crafts, barters, traders, hideout, tasks, itemLocale } = {}) {
  const itemDoc = itemsDocument(items);
  const rawItems = asMap(itemDoc.items);
  const locale = itemLocale || {};

  const craftRows = asArray(unwrapIfNeeded(crafts)).map(normalizeCraft).filter(Boolean);
  const barterRows = asArray(unwrapIfNeeded(barters)).map(normalizeBarter).filter(Boolean);

  const recipeIds = new Set(collectRecipeItemIds(craftRows, barterRows));
  const itemMap = {};

  for (const [id, raw] of Object.entries(rawItems)) {
    const hasCashBuy = asArray(raw?.buyFromTrader).some((o) => Number(o.priceRUB ?? o.price) > 0);
    if (!recipeIds.has(id) && !hasCashBuy) continue;
    const slim = slimItem(raw, locale);
    if (slim) itemMap[id] = slim;
  }

  const flips = buildFlips(itemMap);
  const meta = metaFrom(itemDoc, traders, hideout, craftRows, barterRows, itemMap);
  const taskSource = tasksMap(tasks);
  const unlockIds = collectUnlockTaskIds(craftRows, barterRows, flips, itemMap);
  const unlockTasks = unlockIds.map((id) => {
    const task = taskSource[id] || {};
    const traderId = task.trader || task.traderId || null;
    const reqs = asArray(task.traderRequirements);
    let traderLevel = Number(task.minTraderLevel || task.traderLevel) || 0;
    if (!traderLevel) {
      for (const req of reqs) {
        const value = Number(req.value ?? req.level) || 0;
        if (value) {
          traderLevel = value;
          break;
        }
      }
    }
    if (!traderLevel) {
      let min = Infinity;
      for (const row of [...barterRows, ...flips]) {
        if (row.taskUnlock === id) min = Math.min(min, row.minTraderLevel || 1);
      }
      traderLevel = Number.isFinite(min) ? min : 1;
    }
    return {
      id,
      name: task.name || id,
      traderId,
      traderName: meta.traders[traderId]?.name || null,
      minPlayerLevel: Number(task.minPlayerLevel) || 1,
      traderLevel,
    };
  });

  return {
    lastUpdated: new Date().toISOString(),
    meta,
    items: itemMap,
    crafts: craftRows,
    barters: barterRows,
    flips,
    unlockTasks,
  };
}

function unwrapIfNeeded(value) {
  if (value && typeof value === "object" && "data" in value) return value.data;
  return value;
}
