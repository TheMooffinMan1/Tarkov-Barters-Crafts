import assert from "node:assert/strict";
import test from "node:test";
import { loyaltyForPlayerLevel, traderLevelsForPlayer, fleaUnlocked, canUseFlea } from "../progress.mjs";

const prapor = {
  id: "prapor",
  levels: [
    { level: 1, requiredPlayerLevel: 1 },
    { level: 2, requiredPlayerLevel: 15 },
    { level: 3, requiredPlayerLevel: 26 },
    { level: 4, requiredPlayerLevel: 36 },
  ],
};

test("loyalty follows trader player-level gates", () => {
  assert.equal(loyaltyForPlayerLevel(prapor, 1), 1);
  assert.equal(loyaltyForPlayerLevel(prapor, 15), 2);
  assert.equal(loyaltyForPlayerLevel(prapor, 26), 3);
  assert.equal(loyaltyForPlayerLevel(prapor, 79), 4);
});

test("flea unlocks at the configured PMC level", () => {
  const flea = { enabled: true, minPlayerLevel: 15 };
  assert.equal(fleaUnlocked(flea, 14), false);
  assert.equal(fleaUnlocked(flea, 15), true);
});

test("traderLevelsForPlayer maps every trader id", () => {
  const levels = traderLevelsForPlayer({ prapor }, 20);
  assert.equal(levels.prapor, 2);
});

test("flea prices stay available unless progress filter is on", () => {
  const item = { noFlea: false, minLevelForFlea: 30 };
  const blob = { meta: { flea: { enabled: true, minPlayerLevel: 15 } } };
  assert.equal(canUseFlea(item, blob, { playerLevel: 1, filterToProgress: false }), true);
  assert.equal(canUseFlea(item, blob, { playerLevel: 15, filterToProgress: true }), false);
  assert.equal(canUseFlea(item, blob, { playerLevel: 30, filterToProgress: true }), true);
});
