import { buildProfitBlob } from "../compute/build-blob.mjs";
import { GAME_MODE_IDS, fetchMode } from "./fetch.mjs";
import { blobKey, etagKey, kvGet, kvPut } from "./kv.mjs";

function requestedModes() {
  let raw = process.env.DISPATCH_MODES || process.env.MODES || "";
  raw = String(raw).trim();
  if (raw.startsWith("[")) {
    try {
      raw = JSON.parse(raw).join(",");
    } catch {
      /* keep raw */
    }
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => GAME_MODE_IDS.includes(id));
  return list.length ? list : GAME_MODE_IDS;
}

async function previousEtag(mode) {
  try {
    return await kvGet(etagKey(mode));
  } catch {
    return null;
  }
}

async function processMode(mode) {
  const cachedEtag = await previousEtag(mode);
  const result = await fetchMode(mode, cachedEtag);
  if (!result.changed) {
    console.log(`${mode}: 304, blob unchanged`);
    return { mode, written: false };
  }

  const blob = buildProfitBlob(result.payload);
  blob.meta = { ...blob.meta, gameMode: mode };
  const body = JSON.stringify(blob);
  await kvPut(blobKey(mode), body);
  if (result.itemsEtag) await kvPut(etagKey(mode), result.itemsEtag);
  console.log(
    `${mode}: wrote blob (${(body.length / 1024).toFixed(1)} KiB) crafts=${blob.crafts.length} barters=${blob.barters.length} flips=${blob.flips.length}`,
  );
  return { mode, written: true, bytes: body.length };
}

async function main() {
  const modes = requestedModes();
  console.log("polling", modes.join(", "));
  const results = [];
  for (const mode of modes) {
    results.push(await processMode(mode));
  }
  if (results.every((row) => !row.written) && process.env.REQUIRE_WRITE === "1") {
    console.log("no modes changed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
