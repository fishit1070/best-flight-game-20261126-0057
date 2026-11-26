// main.ts — assembles the KELANA-9 flight-game entry for make.fun.
//
// It copies the finished game into the output folder, brings along any
// screenshots, then asks the vendored builder to produce the dossier for
// the staged bundle. The run is fully offline and deterministic.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const sourceGame = join(scriptDir, "game");
if (!existsSync(sourceGame)) {
  console.error("error: game/ is missing — build the game before running main.ts");
  console.error(`looked for: ${sourceGame}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
cpSync(sourceGame, join(outputDir, "game"), { recursive: true });

const localScreenshots = join(scriptDir, "screenshots");
if (existsSync(localScreenshots)) {
  const stagedScreenshots = join(outputDir, "screenshots");
  mkdirSync(stagedScreenshots, { recursive: true });
  cpSync(localScreenshots, stagedScreenshots, { recursive: true });
}

const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, "dossier.json"), dossierBytes);
console.log(`entry staged in ${outputDir}`);
