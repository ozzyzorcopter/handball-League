// Builds the site into dist/ for GitHub Pages.
//
//   node build.mjs
//
// - bundles app.js twice with esbuild: the normal app and the read-only "share"
//   page (esbuild --define flips __SHARE__, no sed on the source)
// - names every asset with a hash of its content (app.<hash>.js, ...) and writes
//   index.html / index-share.html pointing at them, so a browser can never keep
//   running an old script after a deploy
// - copies the static files the app fetches from the Pages origin
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIST = "dist";
const hash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);

// The Monte Carlo worker is bundled on its own, then embedded in the app bundle
// as a string and started from a Blob URL (see src/mcRunner.js).
export async function bundleWorker() {
  const result = await build({
    entryPoints: ["src/mc.worker.js"],
    bundle: true, minify: true, write: false, outfile: "mc.worker.out.js",
    target: "es2020", legalComments: "none", logLevel: "warning",
  });
  return result.outputFiles[0].text;
}

export async function bundle({ share, workerSrc }) {
  const result = await build({
    entryPoints: ["app.js"],
    bundle: true,
    minify: true,
    write: false,
    outfile: "app.out.js",
    loader: { ".js": "jsx" },
    define: { __SHARE__: String(share), __MC_WORKER_SRC__: JSON.stringify(workerSrc ?? "") },
    target: "es2020",
    legalComments: "none",
    logLevel: "warning",
  });
  return result.outputFiles[0].text;
}

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const css = fs.readFileSync("styles.css");
  const cssName = `styles.${hash(css)}.css`;
  fs.writeFileSync(path.join(DIST, cssName), css);

  const workerSrc = await bundleWorker();
  const template = fs.readFileSync("index.template.html", "utf8");
  const pages = [
    { file: "index.html", share: false, prefix: "app" },
    { file: "index-share.html", share: true, prefix: "app.share" },
  ];
  for (const p of pages) {
    const js = await bundle({ share: p.share, workerSrc });
    const jsName = `${p.prefix}.${hash(js)}.js`;
    fs.writeFileSync(path.join(DIST, jsName), js);
    fs.writeFileSync(path.join(DIST, p.file), template.replace("%CSS%", `./${cssName}`).replace("%JS%", `./${jsName}`));
    console.log(`built ${p.file} -> ${jsName} (${(js.length / 1024).toFixed(0)} kB)`);
  }

  // Files the app loads from the Pages origin.
  for (const f of ["scorer-data.json"]) {
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(DIST, f));
  }
  fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
