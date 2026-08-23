import { DEFAULT_SETTINGS } from "./settings.mjs";
import {
  blobTraderName,
  fleaFeeFor,
  fleaMinPlayerLevel,
  fleaSellBlockedReason,
  itemOf,
  itemSlots,
  traderOfferLocked,
} from "./pricing.mjs";

function perSlot(price, slots) {
  return slots > 0 ? price / slots : price;
}

function traderImageLink(traders, traderId) {
  if (!traderId) return null;
  return traders[traderId]?.imageLink || `https://assets.tarkov.dev/${traderId}.webp`;
}

export function lookupItem(blob, itemId, userSettings = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...userSettings };
  const item = itemOf(blob, itemId);
  if (!item) return null;

  const slots = itemSlots(item);
  const blockedReason = fleaSellBlockedReason(item, blob, settings);
  const canSell = !item.noFlea && blob?.meta?.flea?.enabled !== false;
  const lastLow = Number(item.lastLowPrice) || 0;
  const avg24h = Number(item.avg24hPrice) || 0;
  const feeLastLow = lastLow > 0 ? fleaFeeFor(item, lastLow, settings, blob, 1) : 0;
  const feeAvg24h = avg24h > 0 ? fleaFeeFor(item, avg24h, settings, blob, 1) : 0;
  const traders = blob.meta.traders;

  const traderSell = [...(item.sellToTrader || [])]
    .map((offer) => ({
      traderId: offer.traderId,
      traderName: blobTraderName(traders, offer.traderId),
      traderImageLink: traderImageLink(traders, offer.traderId),
      priceRUB: offer.priceRUB,
      minTraderLevel: offer.minTraderLevel || 1,
      taskUnlock: offer.taskUnlock || null,
      locked: traderOfferLocked(offer, settings, blob),
    }))
    .sort((a, b) => b.priceRUB - a.priceRUB);

  const refs = blob.itemRefs?.[itemId] || { hideout: [], quests: [] };

  return {
    item,
    slots,
    flea: {
      canSell,
      blockedReason: canSell ? blockedReason : blockedReason || "Flea banned",
      minPlayerLevel: fleaMinPlayerLevel(item, blob),
      lastLow,
      avg24h,
      lastLowPerSlot: perSlot(lastLow, slots),
      avg24hPerSlot: perSlot(avg24h, slots),
      feeLastLow,
      feeAvg24h,
      netLastLow: lastLow - feeLastLow,
      netAvg24h: avg24h - feeAvg24h,
    },
    traderSell,
    refs: {
      hideout: refs.hideout || [],
      quests: (refs.quests || []).map((row) => ({
        ...row,
        traderImageLink: traderImageLink(traders, row.traderId),
      })),
    },
  };
}
