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

test("drops bitcoin farm and unused catalogue items", () => {
  const out = blob();
  assert.equal(out.crafts.map((c) => c.id).sort().join(","), "craft-docs,craft-glue,craft-sticky,craft-tooling");
  assert.equal(out.barters.length, 2);
  assert.ok(!out.items["item-junk"]);
  assert.ok(!out.items["item-bitcoin"]);
  assert.ok(out.items["item-bolt"]);
  assert.ok(out.items["item-case"]);
  assert.ok(out.items["item-glue"]);
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
  assert.equal(out.flips.length, 8);
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
