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

  // Third-party files are served from our own origin (no CDN, no Google Fonts):
  // React from node_modules, fonts from the @fontsource packages (latin subset,
  // which covers the accented letters in Belgian team and player names).
  const copyHashed = (src, prefix, ext) => {
    const data = fs.readFileSync(src);
    const name = `${prefix}.${hash(data)}.${ext}`;
    fs.writeFileSync(path.join(DIST, name), data);
    return name;
  };
  const reactName = copyHashed("node_modules/react/umd/react.production.min.js", "vendor.react", "js");
  const reactDomName = copyHashed("node_modules/react-dom/umd/react-dom.production.min.js", "vendor.react-dom", "js");
  const FONTS = [
    ["syne", "Syne", 700], ["syne", "Syne", 800],
    ["dm-mono", "DM Mono", 400], ["dm-mono", "DM Mono", 500],
    ["dm-sans", "DM Sans", 400], ["dm-sans", "DM Sans", 500],
  ];
  const fontCss = FONTS.map(([pkg, family, weight]) => {
    const file = copyHashed(`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`, `font.${pkg}-${weight}`, "woff2");
    return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(./${file}) format("woff2")}`;
  }).join("\n") + "\n";

  const css = Buffer.concat([Buffer.from(fontCss), fs.readFileSync("styles.css")]);
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
    fs.writeFileSync(path.join(DIST, p.file), template.replace("%CSS%", `./${cssName}`).replace("%JS%", `./${jsName}`).replace("%REACT%", `./${reactName}`).replace("%REACTDOM%", `./${reactDomName}`));
    console.log(`built ${p.file} -> ${jsName} (${(js.length / 1024).toFixed(0)} kB)`);
  }

  // PWA files (public/): manifest and icons are copied as they are; the service
  // worker gets a build id so every deploy replaces the previous cache.
  const buildId = hash(fs.readdirSync(DIST).sort().join("|"));
  for (const f of fs.readdirSync("public")) {
    const data = fs.readFileSync(path.join("public", f));
    fs.writeFileSync(path.join(DIST, f), f === "sw.js" ? data.toString("utf8").replace("__BUILD__", buildId) : data);
  }

  fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
