import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("production build contains ChessCoach and its PWA manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("../dist/client/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.short_name, "ChessCoach");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);

  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsUrl);
  const relevant = files.filter((file) => /\.(js|css)$/.test(file));
  const bundled = (await Promise.all(relevant.map((file) => readFile(new URL(file, assetsUrl), "utf8")))).join("\n");
  assert.match(bundled, /ChessCoach/);
  assert.match(bundled, /Stockfish 18 Lite/);
  assert.doesNotMatch(bundled, /Your site is taking shape/);

  const worker = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
  assert.match(worker, /chesscom\/import/);
});