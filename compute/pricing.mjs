import { fleaMarketFee } from "./flea-fee.mjs";
import { canUseFlea, fleaUnlocked } from "./progress.mjs";

export function itemOf(blob, id) {
  return blob.items[id] || null;
}

export function fleaSpotPrice(item, settings) {
  if (settings.useFleaAvg) {
    return Number(item.avg24hPrice) || Number(item.lastLowPrice) || 0;
  }
  return Number(item.lastLowPrice) || Number(item.avg24hPrice) || 0;
}

export function fleaBuyPrice(item, settings, blob) {
  if (!canUseFlea(item, blob, settings)) return 0;
  return fleaSpotPrice(item, settings);
}

export function fleaSellPrice(item, settings, blob) {
  if (!canUseFlea(item, blob, settings)) return 0;
  return fleaSpotPrice(item, settings);
}

export function blobTraderName(traders, traderId) {
  return traders?.[traderId]?.name || traderId;
}

export function bestTraderSell(item, settings, traders, excludeTraderId) {
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
    best.traderName = blobTraderName(traders, best.traderId);
  }
  return best;
}

export function itemSlots(item) {
  const width = Math.max(0, Number(item?.width) || 0);
  const height = Math.max(0, Number(item?.height) || 0);
  const area = width * height;
  return area > 0 ? area : 1;
}

export function fleaFeeFor(item, sellPrice, settings, blob, count = 1) {
  if (!settings.includeFleaFee) return 0;
  return fleaMarketFee(item.basePrice, sellPrice, {
    count,
    intelligenceCenter: settings.intelligenceCenter,
    hideoutManagement: settings.hideoutManagement,
    Ti: blob.meta.flea.sellOfferFeeRate,
    Tr: blob.meta.flea.sellRequirementFeeRate,
  });
}

export function fleaSellBlockedReason(item, blob, settings = {}) {
  if (!item) return "Unknown item";
  if (item.noFlea) return "Flea banned";
  if (!blob?.meta?.flea || blob.meta.flea.enabled === false) return "Flea market disabled";
  const fleaMin = Number(blob.meta.flea.minPlayerLevel) || 15;
  const itemMin = Number(item.minLevelForFlea) || 0;
  const required = Math.max(fleaMin, itemMin);
  if (settings.filterToProgress) {
    const playerLevel = Number(settings.playerLevel) || 0;
    if (!fleaUnlocked(blob.meta.flea, playerLevel)) {
      return `Requires PMC level ${fleaMin}`;
    }
    if (playerLevel < itemMin) {
      return `Requires PMC level ${required}`;
    }
  }
  return null;
}

export function fleaMinPlayerLevel(item, blob) {
  const fleaMin = Number(blob?.meta?.flea?.minPlayerLevel) || 15;
  const itemMin = Number(item?.minLevelForFlea) || 0;
  return Math.max(fleaMin, itemMin);
}

function emptySale() {
  return { sellTo: "—", sellToId: null, sellSource: "none", gross: 0, fee: 0, net: 0 };
}

export function outputSale(item, settings, blob, count, excludeTraderId) {
  const traders = blob.meta.traders;
  const fleaPrice = fleaSellPrice(item, settings, blob);
  const trader = bestTraderSell(item, { ...settings, _traders: traders }, traders, excludeTraderId);
  trader.traderName = blobTraderName(traders, trader.traderId);

  let fleaFee = 0;
  let fleaNet = 0;
  const canFlea = fleaPrice > 0;

  if (canFlea) {
    fleaFee = fleaFeeFor(item, fleaPrice, settings, blob, count);
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

export function traderOfferLocked(offer, settings, blob) {
  if (offer.taskUnlock && settings.hiddenQuestIds?.includes(offer.taskUnlock)) return true;
  if (!settings.filterToProgress) return false;
  const loyalty = settings.traderLevels?.[offer.traderId] ?? 0;
  if (loyalty < (offer.minTraderLevel || 1)) return true;
  if (offer.taskUnlock) {
    const task = (blob.unlockTasks || []).find((row) => row.id === offer.taskUnlock);
    if (task && (Number(task.minPlayerLevel) || 1) > (Number(settings.playerLevel) || 0)) return true;
  }
  return false;
}
