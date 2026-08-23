import assert from "node:assert/strict";
import test from "node:test";
import { buildCategoryIndex, classifyQuestItems } from "../quest-objectives.mjs";

function indexFrom(items, categories) {
  const rawItems = Object.fromEntries(items.map((item) => [item.id, item]));
  return buildCategoryIndex(rawItems, categories);
}

const food = { id: "cat-food", name: "Food", normalizedName: "food" };
const root = { id: "54009119af1c881c07000029", name: "Item", normalizedName: "item" };

test("single-item objectives stay specific", () => {
  const index = indexFrom(
    [{ id: "water", categories: ["cat-food", root.id] }],
    [food, root],
  );
  assert.deepEqual(classifyQuestItems(["water"], index), { kind: "specific" });
});

test("category-wide objectives are labeled with the category name", () => {
  const index = indexFrom(
    [
      { id: "water", categories: ["cat-food", root.id] },
      { id: "soda", categories: ["cat-food", root.id] },
    ],
    [food, root],
  );
  const result = classifyQuestItems(["water", "soda"], index);
  assert.equal(result.kind, "category");
  assert.equal(result.categoryName, "Food");
});

test("literal any-item objectives are skipped", () => {
  const items = Array.from({ length: 200 }, (_, i) => ({
    id: `item-${i}`,
    categories: [root.id],
  }));
  const index = indexFrom(items, [root]);
  const ids = items.map((item) => item.id);
  assert.deepEqual(classifyQuestItems(ids, index), { kind: "any" });
});

test("small mixed lists stay specific", () => {
  const index = indexFrom(
    [
      { id: "bolt", categories: [root.id] },
      { id: "glue", categories: [root.id] },
    ],
    [root],
  );
  assert.deepEqual(classifyQuestItems(["bolt", "glue"], index), { kind: "specific" });
});
