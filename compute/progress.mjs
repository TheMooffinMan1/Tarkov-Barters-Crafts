/** Highest trader loyalty reachable at this PMC level, from each trader's level table. */
export function loyaltyForPlayerLevel(trader, playerLevel) {
  const levels = Array.isArray(trader?.levels) ? trader.levels : [];
  let loyalty = 0;
  for (const row of levels) {
    const need = Number(row.requiredPlayerLevel) || 0;
    const ll = Number(row.level) || 0;
    if (playerLevel >= need && ll > loyalty) loyalty = ll;
  }
  if (!levels.length) {
    if (playerLevel >= 36) return 4;
    if (playerLevel >= 20) return 3;
    if (playerLevel >= 15) return 2;
    return playerLevel >= 1 ? 1 : 0;
  }
  return loyalty;
}

export function traderLevelsForPlayer(traders, playerLevel) {
  const out = {};
  for (const [id, trader] of Object.entries(traders || {})) {
    out[trader?.id || id] = loyaltyForPlayerLevel(trader, playerLevel);
  }
  return out;
}

export function fleaUnlocked(flea, playerLevel) {
  if (!flea || flea.enabled === false) return false;
  return playerLevel >= (Number(flea.minPlayerLevel) || 15);
}

export function canUseFlea(item, blob, settings = {}) {
  if (!item || item.noFlea) return false;
  if (!blob?.meta?.flea || blob.meta.flea.enabled === false) return false;
  if (!settings.filterToProgress) return true;
  const playerLevel = Number(settings.playerLevel) || 0;
  if (!fleaUnlocked(blob.meta.flea, playerLevel)) return false;
  return playerLevel >= (Number(item.minLevelForFlea) || 0);
}
