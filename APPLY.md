Copy these files over the repo (keep folder structure), then:
git rm app.compiled.js app.share.compiled.js index.html index-share.html .github/scripts/diagnose-vhv.js .github/workflows/diagnose-vhv.yml
npm ci && npm test && npm run build
In GitHub: Settings > Pages > Source = "GitHub Actions".
