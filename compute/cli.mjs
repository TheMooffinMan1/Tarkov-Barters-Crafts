import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProfitBlob } from "./build-blob.mjs";
import { GAME_MODE_IDS, fetchMode } from "../poll/fetch.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const all = argv.includes("--all");
  const idx = argv.indexOf("--mode");
  const mode = idx >= 0 ? argv[idx + 1] : "regular";
  const modes = all ? GAME_MODE_IDS : [mode];
  for (const id of modes) {
    if (!GAME_MODE_IDS.includes(id)) {
      throw new Error(`unknown mode ${id}`);
    }
  }
  return modes;
}

async function main() {
  const modes = parseArgs(process.argv.slice(2));
  const outDir = join(root, "frontend", "public");
  mkdirSync(outDir, { recursive: true });

  for (const mode of modes) {
    console.log(`fetching ${mode}…`);
    const result = await fetchMode(mode);
    if (!result.changed) continue;
    const blob = buildProfitBlob(result.payload);
    blob.meta = { ...blob.meta, gameMode: mode };
    const dest = join(outDir, `blob-${mode}.json`);
    writeFileSync(dest, JSON.stringify(blob));
    console.log(
      `wrote ${dest} (${(JSON.stringify(blob).length / 1024).toFixed(1)} KiB) crafts=${blob.crafts.length} barters=${blob.barters.length} flips=${blob.flips.length}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
