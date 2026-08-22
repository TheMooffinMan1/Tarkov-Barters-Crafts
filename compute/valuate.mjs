import { fleaMarketFee } from "./flea-fee.mjs";
import { DEFAULT_SETTINGS } from "./settings.mjs";
import {
  MIN_CRAFT_SECONDS,
  CRAFTING_REDUCTION_PER_LEVEL,
  FUEL_SECONDS_PER_UNIT,
  FUEL_ITEM_IDS,
  PHYSICAL_BITCOIN_ID,
  hideoutConsumptionMultiplier,
  bitcoinPerHour,
} from "./util.mjs";
import { canUseFlea } from "./progress.mjs";

function itemOf(blob, id) {
  return blob.items[id] || null;
}

/** unlockTasks is scanned once per blob instead of per row. */
const unlockTaskIndexCache = new WeakMap();

function unlockTaskById(blob, id) {
  let index = unlockTaskIndexCache.get(blob);
  if (!index) {
    index = new Map();
    for (const row of blob.unlockTasks || []) index.set(row.id, row);
    unlockTaskIndexCache.set(blob, index);
  }
  return index.get(id) || null;
}

function fleaSpotPrice(item, settings) {
  if (settings.useFleaAvg) {
    return Number(item.avg24hPrice) || Number(item.lastLowPrice) || 0;
  }
  return Number(item.lastLowPrice) || Number(item.avg24hPrice) || 0;
}

function fleaBuyPrice(item, settings, blob) {
  if (!canUseFlea(item, blob, settings)) return 0;
  return fleaSpotPrice(item, settings);
}

function fleaSellPrice(item, settings, blob) {
  if (!canUseFlea(item, blob, settings)) return 0;
  return fleaSpotPrice(item, settings);
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

function bestTraderSell(item, settings, excludeTraderId) {
  let best = { priceRUB: 0, traderId: null, traderName: null };
  if (!item) return best;
  for (const offer of item.sellToTrader || []) {
    if (excludeTraderId && offer.traderId === excludeTraderId) continue;
    if (settings.filterToProgress) {
      const loyalty = settings.traderLevels[offer.traderId] ?? 4;
      if (loyalty < 1) continue;
    }
    if (offer.priceRUB > best.priceRUB) {
      best = { priceRUB: offer.priceRUB, traderId: offer.traderId };
    }
  }
  if (best.traderId) {
    best.traderName = blobTraderName(item, best.traderId, settings._traders);
  }
  return best;
}

function blobTraderName(_item, traderId, traders) {
  return traders?.[traderId]?.name || traderId;
}

function canPurchase(item, settings, blob) {
  return fleaBuyPrice(item, settings, blob) > 0 || traderBuyPrice(item, settings) > 0;
}

function firstPositive(pairs) {
  for (const [price, source] of pairs) {
    if (price > 0) return { price, source };
  }
  return { price: 0, source: "none" };
}

function minPositive(pairs) {
  const live = pairs.filter(([price]) => price > 0);
  if (!live.length) return { price: 0, source: "none" };
  live.sort((a, b) => a[0] - b[0]);
  return { price: live[0][0], source: live[0][1] };
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

function recipeHidden(taskUnlock, requiredQuestItems, settings) {
  if (taskUnlock && settings.hiddenQuestIds.includes(taskUnlock)) return true;
  if (!settings.haveQuestItems && requiredQuestItems?.length) return true;
  return false;
}

function unlockBelowPlayer(taskUnlock, settings, blob) {
  if (!settings.filterToProgress || !taskUnlock) return false;
  const task = unlockTaskById(blob, taskUnlock);
  if (!task) return false;
  return (Number(task.minPlayerLevel) || 1) > (Number(settings.playerLevel) || 0);
}

function craftAvailable(craft, settings, blob) {
  if (recipeHidden(craft.taskUnlock, craft.requiredQuestItems, settings)) return false;
  if (unlockBelowPlayer(craft.taskUnlock, settings, blob)) return false;
  if (settings.gameEdition && craft.gameEditions?.length && !craft.gameEditions.includes(settings.gameEdition)) {
    return false;
  }
  if (settings.filterToProgress) {
    const built = settings.stationLevels[craft.stationId] ?? 0;
    if (built < craft.level) return false;
  }
  return true;
}

function barterAvailable(barter, settings, blob) {
  if (recipeHidden(barter.taskUnlock, [], settings)) return false;
  if (unlockBelowPlayer(barter.taskUnlock, settings, blob)) return false;
  if (settings.filterToProgress) {
    const loyalty = settings.traderLevels[barter.traderId] ?? 0;
    if (loyalty < barter.minTraderLevel) return false;
  }
  return true;
}

function cheapestRecipe(itemId, kind, ctx) {
  const list = kind === "craft" ? ctx.craftsByOutput.get(itemId) : ctx.bartersByOutput.get(itemId);
  let best = 0;
  for (const recipe of list || []) {
    const ok = kind === "craft" ? craftAvailable(recipe, ctx.settings, ctx.blob) : barterAvailable(recipe, ctx.settings, ctx.blob);
    if (!ok) continue;
    let sum = 0;
    for (const input of recipe.inputs || []) {
      if (input.tool && !ctx.settings.countToolsAsCost) continue;
      const item = itemOf(ctx.blob, input.id);
      const qty = effectiveInputCount(input, item, ctx.settings);
      const inner = unitCost(input.id, ctx);
      sum += inner.price * qty;
    }
    const count = recipe.output?.count || 1;
    const per = count ? sum / count : sum;
    if (per > 0 && (best === 0 || per < best)) best = per;
  }
  return best;
}

function effectiveInputCount(input, item, settings) {
  const base = Number(input.count) || 0;
  if (!item?.consumable) return base;
  if (item.consumable === "waterFilter" || item.consumable === "airFilter" || item.consumable === "fuel") {
    return base * hideoutConsumptionMultiplier(settings.hideoutManagement);
  }
  return base;
}

function unitCost(id, ctx, valueMode = ctx.settings.inputValue) {
  const memoKey = `${id}::${valueMode}`;
  if (ctx.memo.has(memoKey)) return ctx.memo.get(memoKey);
  if (ctx.stack.has(id)) return { price: 0, source: "none" };

  const item = itemOf(ctx.blob, id);
  const flea = fleaBuyPrice(item, ctx.settings, ctx.blob);
  const trader = traderBuyPrice(item, ctx.settings);
  const mode = valueMode;
  const needsProduction =
    mode === "craft" ||
    mode === "barter" ||
    mode === "lowest" ||
    (flea <= 0 && trader <= 0);

  let craft = 0;
  let barter = 0;
  if (needsProduction) {
    ctx.stack.add(id);
    const wantBoth = mode === "lowest" || (flea <= 0 && trader <= 0);
    if (wantBoth || mode !== "barter") craft = cheapestRecipe(id, "craft", ctx);
    if (wantBoth || mode !== "craft") barter = cheapestRecipe(id, "barter", ctx);
    ctx.stack.delete(id);
  }

  let result;
  switch (mode) {
    case "flea":
    case "fleaLow":
    case "fleaAvg":
      result = firstPositive([
        [flea, "flea"],
        [trader, "trader"],
        [craft, "craft"],
        [barter, "barter"],
      ]);
      break;
    case "trader":
      result = firstPositive([
        [trader, "trader"],
        [flea, "flea"],
        [craft, "craft"],
        [barter, "barter"],
      ]);
      break;
    case "craft":
      result = firstPositive([
        [craft, "craft"],
        [flea, "flea"],
        [trader, "trader"],
        [barter, "barter"],
      ]);
      break;
    case "barter":
      result = firstPositive([
        [barter, "barter"],
        [flea, "flea"],
        [trader, "trader"],
        [craft, "craft"],
      ]);
      break;
    case "lowest":
      result = minPositive([
        [flea, "flea"],
        [trader, "trader"],
        [craft, "craft"],
        [barter, "barter"],
      ]);
      break;
    case "cheapest":
    default:
      result = minPositive([
        [flea, "flea"],
        [trader, "trader"],
      ]);
      if (result.price <= 0) {
        result = firstPositive([
          [craft, "craft"],
          [barter, "barter"],
        ]);
      }
  }

  ctx.memo.set(memoKey, result);
  return result;
}

function makeCostContext(blob, settings) {
  return {
    blob,
    settings,
    memo: new Map(),
    stack: new Set(),
    craftsByOutput: indexByOutput(blob.crafts),
    bartersByOutput: indexByOutput(blob.barters),
  };
}

function consumedUnpurchasable(inputs, ctx) {
  return inputs.some((input) => {
    if (input.tool) return false;
    const item = itemOf(ctx.blob, input.id);
    return !canPurchase(item, ctx.settings, ctx.blob);
  });
}

function costLines(inputs, ctx) {
  const lines = [];
  let total = 0;
  for (const input of inputs) {
    const item = itemOf(ctx.blob, input.id);
    const priced = unitCost(input.id, ctx);
    const qty = effectiveInputCount(input, item, ctx.settings);
    const skipCost = input.tool && !ctx.settings.countToolsAsCost;
    const lineCost = skipCost ? 0 : priced.price * qty;
    total += lineCost;
    lines.push({
      id: input.id,
      count: qty,
      tool: Boolean(input.tool),
      fuel: false,
      name: item?.name || input.id,
      shortName: item?.shortName || input.id,
      iconLink: item?.iconLink,
      unit: priced.price,
      source: priced.source,
      cost: lineCost,
    });
  }
  return { lines, total };
}

function craftFuelLine(durationSeconds, ctx) {
  if (!ctx.settings.includeFuelCost) return null;
  const rate = hideoutConsumptionMultiplier(ctx.settings.hideoutManagement);
  const solar = ctx.settings.solarPower ? 2 : 1;
  const secondsPerUnit = (FUEL_SECONDS_PER_UNIT * solar) / rate;
  if (secondsPerUnit <= 0) return null;
  const unitsNeeded = durationSeconds / secondsPerUnit;
  const fuelMode = ctx.settings.fuelValue || "cheapest";

  let best = null;
  for (const id of FUEL_ITEM_IDS) {
    const item = itemOf(ctx.blob, id);
    if (!item) continue;
    const priced = unitCost(id, ctx, fuelMode);
    if (priced.price <= 0) continue;
    const tankUnits = Number(item.resourceUnits) || 100;
    const cost = (priced.price / tankUnits) * unitsNeeded;
    if (!best || cost < best.cost) {
      best = {
        id,
        count: unitsNeeded / tankUnits,
        tool: false,
        fuel: true,
        name: item.name || id,
        shortName: item.shortName || id,
        iconLink: item.iconLink,
        unit: priced.price,
        source: priced.source,
        cost,
      };
    }
  }
  return best;
}

/** Therapist (best trader) sell for Physical Bitcoin — flea is never used. */
function bitcoinSellRub(blob) {
  const item = itemOf(blob, PHYSICAL_BITCOIN_ID);
  if (!item) return 0;
  let best = 0;
  for (const offer of item.sellToTrader || []) {
    if (offer.priceRUB > best) best = offer.priceRUB;
  }
  return best;
}

function bitcoinIncomePerHour(blob, settings) {
  if (!settings.addBitcoinProfit) return 0;
  const gpus = Number(settings.bitcoinGpus) || 0;
  if (gpus < 1) return 0;
  const sell = bitcoinSellRub(blob);
  if (sell <= 0) return 0;
  return bitcoinPerHour(gpus) * sell;
}

function outputSale(item, settings, blob, count, excludeTraderId) {
  const traders = blob.meta.traders;
  const fleaPrice = fleaSellPrice(item, settings, blob);
  const trader = bestTraderSell(item, { ...settings, _traders: traders }, excludeTraderId);
  trader.traderName = traders[trader.traderId]?.name || trader.traderName;

  let fleaFee = 0;
  let fleaNet = 0;
  const canFlea = fleaPrice > 0;

  if (canFlea) {
    fleaFee = settings.includeFleaFee
      ? fleaMarketFee(item.basePrice, fleaPrice, {
          count,
          intelligenceCenter: settings.intelligenceCenter,
          hideoutManagement: settings.hideoutManagement,
          Ti: blob.meta.flea.sellOfferFeeRate,
          Tr: blob.meta.flea.sellRequirementFeeRate,
        })
      : 0;
    fleaNet = fleaPrice * count - fleaFee;
  }

  const traderNet = trader.priceRUB * count;

  const fleaOption = canFlea
    ? {
        sellTo: blob.meta.flea.name,
        sellToId: "flea-market",
        sellSource: "flea",
        gross: fleaPrice,
        fee: fleaFee,
        net: fleaNet,
      }
    : null;
  const traderOption =
    trader.priceRUB > 0
      ? {
          sellTo: trader.traderName,
          sellToId: trader.traderId,
          sellSource: "trader",
          gross: trader.priceRUB,
          fee: 0,
          net: traderNet,
        }
      : null;

  switch (settings.outputValue) {
    case "flea":
      return fleaOption || traderOption || emptySale();
    case "trader":
      return traderOption || fleaOption || emptySale();
    case "best":
    default: {
      if (fleaOption && traderOption) return fleaOption.net >= traderOption.net ? fleaOption : traderOption;
      return fleaOption || traderOption || emptySale();
    }
  }
}

function emptySale() {
  return { sellTo: "—", sellToId: null, sellSource: "none", gross: 0, fee: 0, net: 0 };
}

function canSell(sale) {
  return Boolean(sale && sale.sellToId);
}

function flipPassesFilters(traderId, minTraderLevel, taskUnlock, settings, blob) {
  if (recipeHidden(taskUnlock, [], settings)) return false;
  if (unlockBelowPlayer(taskUnlock, settings, blob)) return false;
  if (settings.filterToProgress) {
    const loyalty = settings.traderLevels[traderId] ?? 0;
    if (loyalty < (minTraderLevel || 1)) return false;
  }
  if (settings.traderFilter && traderId !== settings.traderFilter) return false;
  if (settings.traderLevelFilter && (minTraderLevel || 1) !== settings.traderLevelFilter) return false;
  return true;
}

function valuateTraderToFlea(blob, settings) {
  const flips = [];
  const fleaSettings = { ...settings, outputValue: "flea" };
  for (const flip of blob.flips || []) {
    if (!flipPassesFilters(flip.traderId, flip.minTraderLevel, flip.taskUnlock, settings, blob)) continue;
    const item = itemOf(blob, flip.itemId);
    if (!item) continue;
    const sale = outputSale(item, fleaSettings, blob, 1);
    if (!sale || sale.sellSource !== "flea") continue;
    const traderName = blob.meta.traders[flip.traderId]?.name || flip.traderId;
    const profit = sale.net - flip.buyPriceRUB;
    flips.push({
      id: flip.id,
      kind: "flip",
      traderId: flip.traderId,
      traderName,
      level: flip.minTraderLevel,
      taskUnlock: flip.taskUnlock,
      taskName: taskName(blob, flip.taskUnlock),
      buyLimit: flip.buyLimit,
      costItems: [
        {
          id: item.id,
          count: 1,
          tool: false,
          name: `${traderName} LL${flip.minTraderLevel}`,
          shortName: item.shortName,
          iconLink: item.iconLink,
          unit: flip.buyPriceRUB,
          source: "trader",
          cost: flip.buyPriceRUB,
        },
      ],
      cost: flip.buyPriceRUB,
      reward: rewardFrom(item, { id: item.id, count: 1 }, sale),
      profit,
      search: nameHay(item, [traderName, taskName(blob, flip.taskUnlock)]),
    });
  }
  return flips;
}

function valuateFleaToTrader(blob, settings) {
  const flips = [];
  for (const item of Object.values(blob.items || {})) {
    if (item.usesDurability) continue;
    const fleaCost = fleaBuyPrice(item, settings, blob);
    if (fleaCost <= 0) continue;
    for (const offer of item.sellToTrader || []) {
      if (!flipPassesFilters(offer.traderId, offer.minTraderLevel, offer.taskUnlock, settings, blob)) continue;
      const traderName = blob.meta.traders[offer.traderId]?.name || offer.traderId;
      const sale = {
        sellTo: traderName,
        sellToId: offer.traderId,
        sellSource: "trader",
        gross: offer.priceRUB,
        fee: 0,
        net: offer.priceRUB,
      };
      const profit = sale.net - fleaCost;
      flips.push({
        id: `${item.id}:flea:${offer.traderId}:${offer.minTraderLevel || 1}`,
        kind: "flip",
        traderId: offer.traderId,
        traderName,
        level: offer.minTraderLevel || 1,
        taskUnlock: offer.taskUnlock || null,
        taskName: taskName(blob, offer.taskUnlock),
        buyLimit: offer.buyLimit ?? null,
        costItems: [
          {
            id: item.id,
            count: 1,
            tool: false,
            name: item.name,
            shortName: item.shortName,
            iconLink: item.iconLink,
            unit: fleaCost,
            source: "flea",
            cost: fleaCost,
          },
        ],
        cost: fleaCost,
        reward: rewardFrom(item, { id: item.id, count: 1 }, sale),
        profit,
        search: nameHay(item, [traderName, taskName(blob, offer.taskUnlock)]),
      });
    }
  }
  return flips;
}

function craftDuration(seconds, settings) {
  const reduced = seconds - (seconds * (settings.craftingSkill * CRAFTING_REDUCTION_PER_LEVEL)) / 100;
  return Math.max(MIN_CRAFT_SECONDS, Math.floor(reduced));
}

function nameHay(item, extra = []) {
  return [item?.name, item?.shortName, ...extra].filter(Boolean).join(" ").toLowerCase();
}

function taskName(blob, id) {
  if (!id) return null;
  const task = unlockTaskById(blob, id);
  return task?.name || id;
}

function rewardFrom(item, output, sale) {
  return {
    id: output.id,
    count: output.count,
    name: item?.name || output.id,
    shortName: item?.shortName || output.id,
    iconLink: item?.iconLink,
    noFlea: Boolean(item?.noFlea),
    sellTo: sale.sellTo,
    sellSource: sale.sellSource,
    gross: sale.gross,
    fee: sale.fee,
    net: sale.net,
  };
}

export function valuate(blob, userSettings = {}, parts = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...userSettings };
  if (settings.inputValue === "fleaAvg") {
    settings.useFleaAvg = userSettings.useFleaAvg ?? true;
    settings.inputValue = "flea";
  } else if (settings.inputValue === "fleaLow") {
    settings.inputValue = "flea";
  }
  const hiddenQuests = new Set(settings.hiddenQuestIds || []);
  settings.hiddenQuestIds = [...hiddenQuests];
  const wantCrafts = parts.crafts !== false;
  const wantBarters = parts.barters !== false;
  const wantFlips = parts.flips !== false;
  const ctx = wantCrafts || wantBarters ? makeCostContext(blob, settings) : null;
  const btcPerHour = wantCrafts ? bitcoinIncomePerHour(blob, settings) : 0;

  const crafts = [];
  if (wantCrafts) {
  for (const craft of blob.crafts || []) {
    if (!craftAvailable(craft, settings, blob)) continue;
    if (settings.stationFilter && craft.stationId !== settings.stationFilter) continue;
    if (settings.hideUnpurchasable && consumedUnpurchasable(craft.inputs, ctx)) continue;

    const outputItem = itemOf(blob, craft.output.id);
    const { lines, total } = costLines(craft.inputs, ctx);
    const duration = craftDuration(craft.duration, settings);
    const fuelLine = craftFuelLine(duration, ctx);
    if (fuelLine) {
      lines.push(fuelLine);
    }
    const cost = total + (fuelLine?.cost || 0);
    const effectiveDuration = settings.dualCraft && settings.craftingSkill >= 51 ? duration / 2 : duration;
    const sale = outputSale(outputItem, settings, blob, craft.output.count);
    if (!canSell(sale)) continue;
    const hours = effectiveDuration / 3600;
    const btcBonus = btcPerHour * (duration / 3600);
    const profit = sale.net - cost + btcBonus;
    const profitPerHour = hours > 0 ? Math.floor((sale.net - cost) / hours + btcPerHour) : 0;
    const station = blob.meta.stations[craft.stationId];

    crafts.push({
      id: craft.id,
      kind: "craft",
      stationId: craft.stationId,
      stationName: station?.name || craft.stationId,
      level: craft.level,
      taskUnlock: craft.taskUnlock,
      duration,
      costItems: lines,
      cost,
      reward: rewardFrom(outputItem, craft.output, sale),
      profit,
      profitPerHour,
      search: nameHay(outputItem, [station?.name, ...lines.map((l) => l.name)]),
    });
  }
  }

  const barters = [];
  if (wantBarters) {
  for (const barter of blob.barters || []) {
    if (!barterAvailable(barter, settings, blob)) continue;
    if (settings.traderFilter && barter.traderId !== settings.traderFilter) continue;
    if (settings.traderLevelFilter && barter.minTraderLevel !== settings.traderLevelFilter) continue;
    if (settings.hideUnpurchasable && consumedUnpurchasable(barter.inputs, ctx)) continue;

    const outputItem = itemOf(blob, barter.output.id);
    const traderName = blob.meta.traders[barter.traderId]?.name || barter.traderId;
    const { lines, total } = costLines(barter.inputs, ctx);
    const sale = outputSale(outputItem, settings, blob, barter.output.count);
    if (!canSell(sale)) continue;
    const profit = sale.net - total;

    barters.push({
      id: barter.id,
      kind: "barter",
      traderId: barter.traderId,
      traderName,
      level: barter.minTraderLevel,
      taskUnlock: barter.taskUnlock,
      taskName: taskName(blob, barter.taskUnlock),
      buyLimit: barter.buyLimit,
      costItems: lines,
      cost: total,
      reward: rewardFrom(outputItem, barter.output, sale),
      profit,
      search: nameHay(outputItem, [traderName, taskName(blob, barter.taskUnlock), ...lines.map((l) => l.name)]),
    });
  }
  }

  const flips = wantFlips
    ? settings.flipDirection === "fleaToTrader"
      ? valuateFleaToTrader(blob, settings)
      : valuateTraderToFlea(blob, settings)
    : [];

  return { crafts, barters, flips };
}
