import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildProfitBlob } from "../build-blob.mjs";

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

test("includes full catalogue items", () => {
  const out = blob();
  assert.equal(
    out.crafts.map((c) => c.id).sort().join(","),
    "craft-docs,craft-glue,craft-sticky,craft-superwater,craft-tooling",
  );
  assert.equal(out.barters.length, 2);
  assert.ok(out.items["item-junk"]);
  assert.ok(out.items["item-bitcoin"]);
  assert.ok(out.items["item-bolt"]);
  assert.equal(out.items["item-junk"].search, "unusedjunkjunk");
  assert.equal(out.items["item-junk"].width, 1);
  assert.equal(out.items["item-junk"].height, 1);
});

test("tools are flagged and not treated as extra product", () => {
  const craft = blob().crafts.find((c) => c.id === "craft-docs");
  assert.equal(craft.inputs.length, 2);
  assert.equal(craft.inputs.filter((i) => i.tool).length, 1);
  assert.equal(craft.output.id, "item-case");
});

test("unlock tasks are the referenced quests only", () => {
  const out = blob();
  assert.equal(out.unlockTasks.length, 1);
  assert.equal(out.unlockTasks[0].id, "quest-gunsmith");
  assert.equal(out.unlockTasks[0].name, "Gunsmith - Part 1");
  assert.equal(out.unlockTasks[0].traderId, "trader-mechanic");
  assert.equal(out.unlockTasks[0].minPlayerLevel, 10);
  assert.equal(out.unlockTasks[0].traderLevel, 2);
});

test("cash-buy items become flips", () => {
  const out = blob();
  assert.equal(out.flips.length, 10);
  assert.ok(out.flips.some((flip) => flip.traderId === "trader-prapor" && flip.buyPriceRUB === 700));
  assert.equal(out.items["item-gun"].usesDurability, true);
  assert.equal(out.items["item-key"].usesDurability, true);
  assert.equal(out.items["item-water"].usesDurability, true);
  assert.equal(out.items["item-analgin"].usesDurability, true);
  assert.equal(out.items["item-ai2"].usesDurability, true);
  assert.equal(out.items["item-armor"].usesDurability, true);
  assert.equal(out.items["item-bandage"].usesDurability, false);
});

test("meta carries flea rates and station names", () => {
  const out = blob();
  assert.equal(out.meta.flea.sellOfferFeeRate, 0.03);
  assert.equal(out.meta.stations["station-workbench"].name, "Workbench");
  assert.equal(out.meta.traders["trader-mechanic"].name, "Mechanic");
  assert.equal(out.meta.traders["trader-mechanic"].levels[1].requiredPlayerLevel, 20);
  assert.ok(out.lastUpdated);
});

test("itemRefs index hideout and quest requirements", () => {
  const out = blob();
  const filter = out.itemRefs["5d1b385e86f774252167b98a"];
  assert.equal(filter.hideout.length, 1);
  assert.equal(filter.hideout[0].stationName, "Lavatory");
  assert.equal(filter.hideout[0].level, 3);
  assert.equal(filter.hideout[0].count, 2);
  assert.equal(filter.hideout[0].foundInRaid, true);

  const bolt = out.itemRefs["item-bolt"];
  assert.equal(bolt.hideout.length, 1);
  assert.equal(bolt.hideout[0].foundInRaid, false);
  assert.equal(bolt.quests.length, 3);
  assert.ok(bolt.quests.some((row) => row.taskName === "Gunsmith - Part 1" && row.type === "giveItem" && row.foundInRaid && row.traderLevel === 2));
  assert.ok(bolt.quests.some((row) => row.taskName === "Find bolts" && row.type === "findItem" && row.traderId === "trader-prapor"));
  assert.ok(bolt.quests.some((row) => row.taskName === "BTR delivery" && row.traderId === "656f0f98d80a697f855d34b1"));
  assert.ok(out.meta.traders["656f0f98d80a697f855d34b1"]?.imageLink);
});

test("items get short-name slugs and a slug index", () => {
  const out = blob();
  assert.equal(out.items["item-bolt"].slug, "bolts");
  assert.equal(out.itemSlugs.bolts, "item-bolt");
});
