// The built site must be installable: manifest, icons and a service worker
// whose cache name changes with every build, and pages that point at them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

test("build output is a working PWA", () => {
  execFileSync("node", ["build.mjs"], { stdio: "pipe" });
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /serviceWorker/);
  assert.doesNotMatch(html, /cdnjs|googleapis/, "no third-party hosts");

  const manifest = JSON.parse(fs.readFileSync("dist/manifest.webmanifest", "utf8"));
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) assert.ok(fs.existsSync("dist/" + icon.src), icon.src + " missing");
  assert.ok(fs.existsSync("dist/apple-touch-icon.png"));

  const sw = fs.readFileSync("dist/sw.js", "utf8");
  assert.doesNotMatch(sw, /__BUILD__/, "build id substituted");
  assert.match(sw, /const CACHE = "leaguesim-[0-9a-f]{10}"/);

  // Every local file the page loads exists in dist.
  for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) assert.ok(fs.existsSync("dist/" + m[1]), m[1] + " missing in dist");
});
