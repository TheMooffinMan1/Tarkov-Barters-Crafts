# Tarkov Craft, Barter & Flip Profit Site

Public, no-login tracker for hideout crafts, trader barters, and cash trader → flea/trader flips. Prices come from [json.tarkov.dev](https://json.tarkov.dev). Visitors never download the 16.7 MB items dump — GitHub builds a slim blob, the browser recalculates profit from your settings.

Settings live in `localStorage` only. There are no accounts.

Data and hosting constraints (Workers memory, KV write caps, no GraphQL) are documented in the original brief this repo follows.

## Local development

Needs Node 20+.

```bash
npm test
npm run blob -- --mode regular
npm --prefix frontend install
npm run frontend
```

`npm run blob` writes `frontend/public/blob-regular.json`. Use `--all` (PvP, PvE, and Seasonal) so every mode toggle has a file. Identify yourself: requests send a `User-Agent` that includes `REPO_URL` when set.

On Windows, this repo’s folder name contains `&`, which breaks `.cmd` shims. The frontend scripts call Vite through `node` for that reason. From the repo root, `npm run test` and `npm run blob` are fine; for the UI, `cd frontend` then `npm install` / `npm run dev`.

## Architecture

```
Browser visit (and every 2 min while tab is open)
  POST /api/poll  →  worker HEAD /{mode}/items, compare ETag to KV
  if changed → repository_dispatch
Cloudflare Worker cron (every 30 min, skipped if a visitor poll ran recently)
  same HEAD / ETag check as fallback when nobody is on the site
GitHub Actions
  GET items, crafts, barters + small name tables
  buildProfitBlob()  →  KV blob:{mode} + etag:items:{mode}
Cloudflare Worker
  GET /api/blob?mode=  →  KV via Cache API (2 min)
Cloudflare Pages
  static UI, valuates the blob in the browser
```

Compute (`compute/`) has no fetch, no env, and no Cloudflare/GitHub APIs.

## Cloudflare + GitHub setup

1. Make this repository **public** (free Actions minutes).
2. Create a KV namespace: `npx wrangler kv namespace create PROFIT_KV` and put the id in [`worker/wrangler.toml`](worker/wrangler.toml).
3. Set `GITHUB_REPO` in `wrangler.toml` to `owner/repo`.
4. Worker secrets:
   - `GITHUB_DISPATCH_TOKEN` — fine-grained PAT that can send `repository_dispatch` (`contents: write` is enough on a classic PAT).
5. GitHub Actions secrets:
   - `CF_ACCOUNT_ID`
   - `CF_API_TOKEN` — KV write on that namespace
   - `CF_KV_NAMESPACE_ID`
6. Deploy the worker: `npx wrangler deploy` from `worker/`. Price checks run when someone opens the site (then every 2 minutes while their tab stays open), with a **30-minute cron fallback** if nobody visits. Trigger an initial run with **Actions → Poll tarkov.dev → Run workflow** before first visit.
7. Cloudflare Pages: build `npm --prefix frontend install && npm --prefix frontend run build`, output `frontend/dist`. Set `VITE_BLOB_BASE` to the worker origin (for example `https://tarkov-profit.<account>.workers.dev`) so the UI loads `/api/blob`. Set `VITE_SITE_URL` to your public Pages URL (for example `https://your-project.pages.dev`) so canonical links, Open Graph, `sitemap.xml`, and `robots.txt` use the correct origin. Route `/api/*` to the worker if you put both on one domain.

The cron only sends lightweight HEAD requests to tarkov.dev; full downloads run in GitHub Actions when the ETag changes. Paying for Workers does **not** let you parse `/items` on Cloudflare (128 MB isolate limit).

## Courtesy

`json.tarkov.dev` is donation-funded and not edge-cached. This project always sends `If-None-Match` and `Accept-Encoding: gzip`, never calls GraphQL, and never loops `/prices/{itemId}`. Please [support tarkov.dev](https://tarkov.dev).
