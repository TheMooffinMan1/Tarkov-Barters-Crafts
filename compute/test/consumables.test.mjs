import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildProfitBlob } from "../build-blob.mjs";
import { valuateConsumables } from "../consumables.mjs";
import { DEFAULT_SETTINGS } from "../settings.mjs";

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixture.json"), "utf8"));

const built = buildProfitBlob({
  items: fixture.items,
  crafts: fixture.crafts,
  barters: {
    data: [
      ...fixture.barters.data,
      {
        id: "barter-fuel",
        trader: "trader-mechanic",
        taskUnlock: null,
        minTraderLevel: 1,
        buyLimit: 2,
        requiredItems: [{ item: "item-bolt", "count": 10, attributes: {} }],
        offeredItem: { item: "5d1b36a186f7742523398433", count: 1, attributes: {} },
      },
      {
        id: "barter-filter",
        trader: "trader-therapist",
        taskUnlock: null,
        minTraderLevel: 2,
        buyLimit: 1,
        requiredItems: [{ item: "item-superwater", count: 2, attributes: {} }],
        offeredItem: { item: "5d1b385e86f774252167b98a", count: 1, attributes: {} },
      },
    ],
  },
  traders: fixture.traders,
  hideout: fixture.hideout,
  tasks: fixture.tasks,
});

test("fuel rows include buys and barters priced per fuel unit", () => {
  const { fuel } = valuateConsumables(built, DEFAULT_SETTINGS);
  assert.ok(fuel.length >= 3);

  const fleaMetal = fuel.find((row) => row.id === "buy:5d1b36a186f7742523398433:flea");
  assert.ok(fleaMetal);
  assert.equal(fleaMetal.pricePerUnit, 100000 / 100);
  assert.equal(fleaMetal.method, "flea");

  const prapor = fuel.find((row) => row.id.startsWith("buy:5d1b36a186f7742523398433:trader-prapor"));
  assert.ok(prapor);
  assert.equal(prapor.pricePerUnit, 90000 / 100);

  const barter = fuel.find((row) => row.id === "barter:barter-fuel");
  assert.ok(barter);
  assert.equal(barter.totalCost, 7000);
  assert.equal(barter.pricePerUnit, 7000 / 100);
  assert.equal(barter.costItems[0].source, "trader");
});

test("cheapest fuel method is flagged", () => {
  const { fuel } = valuateConsumables(built, DEFAULT_SETTINGS);
  const cheapest = fuel.filter((row) => row.cheapest);
  assert.equal(cheapest.length, 1);
  assert.equal(cheapest[0].id, "barter:barter-fuel");
});

test("filter rows use per-filter pricing", () => {
  const { filters } = valuateConsumables(built, DEFAULT_SETTINGS);
  const flea = filters.find((row) => row.id === "buy:5d1b385e86f774252167b98a:flea");
  assert.equal(flea.pricePerUnit, 20000);

  const barter = filters.find((row) => row.id === "barter:barter-filter");
  assert.equal(barter.totalCost, 100000);
  assert.equal(barter.pricePerUnit, 100000);
});

test("barter input costs use flea or trader only", () => {
  const { filters } = valuateConsumables(built, {
    ...DEFAULT_SETTINGS,
    useFleaAvg: true,
  });
  const barter = filters.find((row) => row.id === "barter:barter-filter");
  assert.equal(barter.costItems[0].unit, 51000);
  assert.equal(barter.costItems[0].source, "flea");
});
