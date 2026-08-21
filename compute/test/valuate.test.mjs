import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildProfitBlob } from "../build-blob.mjs";
import { valuate } from "../valuate.mjs";
import { fleaMarketFee } from "../flea-fee.mjs";
import { DEFAULT_SETTINGS } from "../settings.mjs";

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixture.json"), "utf8"));

const built = buildProfitBlob({
  items: fixture.items,
  crafts: fixture.crafts,
  barters: fixture.barters,
  traders: fixture.traders,
  hideout: fixture.hideout,
  tasks: fixture.tasks,
});

function docs(settings = {}) {
  return valuate(built, { ...DEFAULT_SETTINGS, ...settings }).crafts.find((row) => row.id === "craft-docs");
}

test("cheapest inputs use trader buy and ignore returned tools", () => {
  const row = docs({ inputValue: "cheapest", outputValue: "flea" });
  assert.equal(row.cost, 1400);
  assert.equal(row.duration, 3600);
  const tool = row.costItems.find((line) => line.tool);
  assert.equal(tool.unit, 700);
  assert.equal(tool.source, "trader");
  assert.equal(tool.cost, 0);
});

test("flea input falls back to the trader price instead of zero", () => {
  const row = docs({ inputValue: "flea", traderLevels: { "trader-prapor": 0 } });
  const bolts = row.costItems.find((line) => !line.tool);
  assert.equal(bolts.unit, 1000);
  assert.equal(bolts.source, "flea");
});

test("hydrated trader levels do not zero trader buys until progress filter is on", () => {
  const open = docs({ inputValue: "trader", traderLevels: { "trader-prapor": 0 } });
  const gated = docs({
    inputValue: "trader",
    filterToProgress: true,
    stationLevels: { "station-workbench": 3 },
    traderLevels: { "trader-prapor": 0 },
  });
  assert.equal(open.costItems.find((line) => !line.tool).unit, 700);
  assert.equal(gated.costItems.find((line) => !line.tool).source, "flea");
  assert.equal(gated.costItems.find((line) => !line.tool).unit, 1000);
});

test("quest checklist hides matching crafts", () => {
  const { crafts } = valuate(built, { hiddenQuestIds: ["quest-gunsmith"] });
  assert.equal(crafts.some((row) => row.id === "craft-docs"), false);
});

test("crafting skill shortens duration and raises profit per hour", () => {
  const base = docs({ craftingSkill: 0, outputValue: "flea" });
  const elite = docs({ craftingSkill: 51, outputValue: "flea" });
  assert.equal(base.duration, 3600);
  assert.equal(elite.duration, 2223);
  assert.ok(elite.profitPerHour > base.profitPerHour);
});

test("progress filter hides barters above loyalty", () => {
  const open = valuate(built, {
    filterToProgress: true,
    hideUnpurchasable: false,
    traderLevels: { "trader-mechanic": 4 },
  }).barters;
  const locked = valuate(built, {
    filterToProgress: true,
    hideUnpurchasable: false,
    traderLevels: { "trader-mechanic": 1 },
  }).barters;
  assert.equal(open.length, 2);
  assert.equal(locked.length, 1);
  assert.equal(locked[0].id, "barter-glue");
});

test("useFleaAvg prices buys and sells from the 24h average", () => {
  const last = docs({ inputValue: "flea", outputValue: "flea", useFleaAvg: false });
  const avg = docs({ inputValue: "flea", outputValue: "flea", useFleaAvg: true });
  assert.equal(last.costItems.find((line) => !line.tool).unit, 1000);
  assert.equal(avg.costItems.find((line) => !line.tool).unit, 1100);
  assert.equal(last.reward.gross, 8000);
  assert.equal(avg.reward.gross, 8200);
});

test("flea output subtracts the listing fee", () => {
  const row = docs({
    inputValue: "cheapest",
    outputValue: "flea",
    includeFleaFee: true,
    intelligenceCenter: 3,
    hideoutManagement: 0,
  });
  const fee = fleaMarketFee(3000, 8000, {
    intelligenceCenter: 3,
    hideoutManagement: 0,
    Ti: 0.03,
    Tr: 0.03,
  });
  assert.equal(row.reward.fee, fee);
  assert.equal(row.profit, 8000 - fee - 1400);
});

test("unpurchasable inputs use the cheapest craft and can be hidden", () => {
  const shown = valuate(built, { ...DEFAULT_SETTINGS, hideUnpurchasable: false });
  const sticky = shown.crafts.find((row) => row.id === "craft-sticky");
  const glue = sticky.costItems.find((line) => line.id === "item-glue");
  assert.equal(glue.source, "craft");
  assert.equal(glue.unit, 700);
  assert.ok(shown.barters.some((row) => row.id === "barter-glue"));

  const hidden = valuate(built, { ...DEFAULT_SETTINGS, hideUnpurchasable: true });
  assert.equal(hidden.crafts.some((row) => row.id === "craft-sticky"), false);
  assert.ok(hidden.crafts.some((row) => row.id === "craft-tooling"));
  assert.equal(hidden.barters.some((row) => row.id === "barter-glue"), false);
  assert.ok(hidden.barters.some((row) => row.id === "barter-docs"));
});

test("traderToFlea buys from the trader and sells on flea", () => {
  const { flips } = valuate(built, { flipDirection: "traderToFlea", outputValue: "trader" });
  const row = flips.find((flip) => flip.id.startsWith("item-bolt:"));
  assert.ok(row);
  assert.equal(row.cost, 700);
  assert.equal(row.costItems[0].source, "trader");
  assert.equal(row.reward.sellSource, "flea");
  assert.equal(row.reward.gross, 1000);
});

test("fleaToTrader buys on flea and sells to the trader", () => {
  const last = valuate(built, { flipDirection: "fleaToTrader", useFleaAvg: false }).flips.find((flip) =>
    flip.id.startsWith("item-bolt:"),
  );
  const avg = valuate(built, { flipDirection: "fleaToTrader", useFleaAvg: true }).flips.find((flip) =>
    flip.id.startsWith("item-bolt:"),
  );
  assert.ok(last);
  assert.equal(last.cost, 1000);
  assert.equal(last.costItems[0].source, "flea");
  assert.equal(last.reward.sellSource, "trader");
  assert.equal(last.reward.net, 400);
  assert.equal(last.profit, -600);
  assert.equal(avg.cost, 1100);
});

test("fleaToTrader hides guns and keys that use durability", () => {
  const { flips } = valuate(built, { flipDirection: "fleaToTrader" });
  assert.equal(flips.some((flip) => flip.id.startsWith("item-gun:")), false);
  assert.equal(flips.some((flip) => flip.id.startsWith("item-key:")), false);
  assert.equal(flips.some((flip) => flip.id.startsWith("item-water:")), false);
  assert.equal(flips.some((flip) => flip.id.startsWith("item-analgin:")), false);
  assert.equal(flips.some((flip) => flip.id.startsWith("item-ai2:")), false);
  assert.equal(flips.some((flip) => flip.id.startsWith("item-armor:")), false);
  assert.ok(flips.some((flip) => flip.id.startsWith("item-bolt:")));
  assert.ok(flips.some((flip) => flip.id.startsWith("item-bandage:")));
  assert.equal(built.items["item-gun"].usesDurability, true);
  assert.equal(built.items["item-key"].usesDurability, true);
  assert.equal(built.items["item-bolt"].usesDurability, false);
  assert.equal(built.items["item-bandage"].usesDurability, false);
});

test("unsellable outputs are omitted", () => {
  const { crafts } = valuate(built, DEFAULT_SETTINGS);
  assert.equal(crafts.some((row) => row.id === "craft-glue"), false);
});

test("water filter crafts use fractional count and Hideout Management reduces consumption", () => {
  const base = valuate(built, { ...DEFAULT_SETTINGS, hideoutManagement: 0, includeFuelCost: false }).crafts.find(
    (row) => row.id === "craft-superwater",
  );
  const elite = valuate(built, { ...DEFAULT_SETTINGS, hideoutManagement: 50, includeFuelCost: false }).crafts.find(
    (row) => row.id === "craft-superwater",
  );
  const filter = base.costItems.find((line) => line.id === "5d1b385e86f774252167b98a");
  const filterElite = elite.costItems.find((line) => line.id === "5d1b385e86f774252167b98a");
  assert.equal(filter.count, 0.66);
  assert.equal(filter.unit, 18000);
  assert.equal(filter.cost, 18000 * 0.66);
  assert.equal(filterElite.count, 0.66 * 0.75);
  assert.equal(filterElite.cost, 18000 * 0.66 * 0.75);
});

test("optional fuel cost uses cheapest tank and respects solar / HM", () => {
  const off = valuate(built, { ...DEFAULT_SETTINGS, includeFuelCost: false }).crafts.find((row) => row.id === "craft-docs");
  const on = valuate(built, {
    ...DEFAULT_SETTINGS,
    includeFuelCost: true,
    fuelValue: "cheapest",
    solarPower: false,
    hideoutManagement: 0,
  }).crafts.find((row) => row.id === "craft-docs");
  const solar = valuate(built, {
    ...DEFAULT_SETTINGS,
    includeFuelCost: true,
    fuelValue: "cheapest",
    solarPower: true,
    hideoutManagement: 0,
  }).crafts.find((row) => row.id === "craft-docs");

  assert.equal(off.costItems.some((line) => line.fuel), false);
  const fuel = on.costItems.find((line) => line.fuel);
  assert.ok(fuel);
  assert.ok(fuel.cost > 0);
  assert.ok(on.cost > off.cost);
  const fuelSolar = solar.costItems.find((line) => line.fuel);
  assert.ok(Math.abs(fuelSolar.cost - fuel.cost / 2) < 0.01);
});

test("subtract bitcoin farm income from craft profit using Therapist sell", () => {
  const plain = valuate(built, {
    ...DEFAULT_SETTINGS,
    includeFuelCost: false,
    subtractBitcoinProfit: false,
  }).crafts.find((row) => row.id === "craft-docs");
  const withBtc = valuate(built, {
    ...DEFAULT_SETTINGS,
    includeFuelCost: false,
    subtractBitcoinProfit: true,
    bitcoinGpus: 1,
  }).crafts.find((row) => row.id === "craft-docs");
  // 1 GPU: 300000s/coin → 3600/300000 BTC/h → * 400000 Therapist
  const btcPerHour = (3600 / 300000) * 400000;
  assert.ok(Math.abs(plain.profit - withBtc.profit - btcPerHour * (plain.duration / 3600)) < 1);
  assert.ok(withBtc.profit < plain.profit);
  assert.ok(withBtc.profitPerHour < plain.profitPerHour);
});
