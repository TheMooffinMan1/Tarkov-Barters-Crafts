import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildProfitBlob } from "../build-blob.mjs";
import { lookupItem } from "../item-lookup.mjs";

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixture.json"), "utf8"));

function blob() {
  return buildProfitBlob({
    items: fixture.items,
    crafts: fixture.crafts,
    barters: fixture.barters,
    traders: fixture.traders,
    hideout: fixture.hideout,
    tasks: fixture.tasks,
  });
}

test("lookupItem returns flea-banned messaging for noFlea items", () => {
  const data = blob();
  const result = lookupItem(data, "item-glue", { filterToProgress: false });
  assert.equal(result.flea.canSell, false);
  assert.match(result.flea.blockedReason, /Flea banned/i);
});

test("lookupItem computes per-slot flea prices", () => {
  const data = blob();
  const result = lookupItem(data, "item-junk", { filterToProgress: false, includeFleaFee: false });
  assert.equal(result.slots, 1);
  assert.equal(result.flea.lastLow, 10);
  assert.equal(result.flea.avg24h, 10);
  assert.equal(result.flea.lastLowPerSlot, 10);
  assert.equal(result.flea.avg24hPerSlot, 10);
});

test("lookupItem sorts trader sell offers by price", () => {
  const data = blob();
  const result = lookupItem(data, "59faff1d86f7746c51718c9c", { filterToProgress: false });
  assert.equal(result.traderSell[0].traderName, "Therapist");
  assert.equal(result.traderSell[0].priceRUB, 400000);
  assert.equal(result.traderSell[1].priceRUB, 200000);
  assert.ok(result.traderSell[0].traderImageLink);
});

test("lookupItem passes hideout and quest refs with trader images", () => {
  const data = blob();
  const result = lookupItem(data, "item-bolt", { filterToProgress: false });
  assert.equal(result.refs.hideout.length, 1);
  assert.equal(result.refs.hideout[0].stationImageLink, "https://assets.tarkov.dev/station-lavatory.png");
  assert.equal(result.refs.quests.length, 3);
  const gunsmith = result.refs.quests.find((row) => row.taskName === "Gunsmith - Part 1");
  assert.equal(gunsmith?.traderLevel, 2);
  assert.ok(gunsmith?.traderImageLink);
  const btr = result.refs.quests.find((row) => row.taskName === "BTR delivery");
  assert.equal(btr?.traderImageLink, "https://assets.tarkov.dev/656f0f98d80a697f855d34b1.webp");
});

test("lookupItem returns null for unknown items", () => {
  const data = blob();
  assert.equal(lookupItem(data, "missing-item", {}), null);
});
