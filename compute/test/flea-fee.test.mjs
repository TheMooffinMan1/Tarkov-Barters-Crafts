import assert from "node:assert/strict";
import test from "node:test";
import { fleaMarketFee } from "../flea-fee.mjs";

test("equal handbook and sell price, no intel discount", () => {
  assert.equal(fleaMarketFee(10000, 10000, { Ti: 0.03, Tr: 0.03, intelligenceCenter: 0 }), 600);
});

test("intel center 3 reduces the fee by 30% at HM 0", () => {
  assert.equal(
    fleaMarketFee(10000, 10000, { Ti: 0.03, Tr: 0.03, intelligenceCenter: 3, hideoutManagement: 0 }),
    420,
  );
});

test("zero prices produce no fee", () => {
  assert.equal(fleaMarketFee(0, 1000), 0);
  assert.equal(fleaMarketFee(1000, 0), 0);
});
