# full-blocker

Ad, banner and tracker blocker for **Chromium** (Chrome / Brave / Edge),
Manifest V3 — with a special focus on **removing YouTube ads without triggering
the anti-adblock wall**. Personal use, loaded as an unpacked extension.

## How it works (overview)
- **Network** (`declarativeNetRequest`): rulesets generated from EasyList +
  EasyPrivacy plus a curated ruleset. Blocks ad/tracker requests on every site.
- **YouTube** (content scripts): DNR cannot block YouTube ads (they come from the
  same domains as the video), and blocking requests there triggers the
  "ad blockers violate ToS" wall. So instead we **(a)** keep DNR from blocking
  anything on YouTube and **(b)** strip the ad descriptors from the player
  response in the page's MAIN world before the player reads them — same approach
  uBlock Origin uses. A second content script also auto-skips/seeks/mutes ads and
  hides overlay/banner ads. The ad-decision logic lives in
  `src/core/youtube/` and is fully unit-tested.
- **Cosmetic** (content script): CSS that hides common ad containers/banners.
- **Popup**: global on/off, per-site allowlist, and a per-tab breakdown of what
  was blocked (with a count badge on the toolbar icon).

> On YouTube the blocked count is intentionally **0**: nothing is blocked at the
> network level there — ads are removed client-side. On other sites the count
> reflects real network blocking.

## Architecture

Clean-ish layering: a **pure, testable domain** (`src/core`, no `chrome.*`), a
small **ports** layer (`src/shared`), and **adapters** (`src/entrypoints`) that
wire the domain to the browser APIs. Static DNR rulesets are produced at build
time from filter lists.

```mermaid
flowchart TB
  subgraph build["Build time"]
    BR["scripts/build-rules.ts"]
    FIL["core/filters/abp-to-dnr"]
    BR --> FIL --> RULES[("src/public/rules/*.json<br/>static DNR rulesets")]
  end

  subgraph ext["Runtime — Chromium MV3"]
    POP["popup<br/>toggle · allowlist · stats"]
    SW["background<br/>service worker"]
    CS1["content.ts<br/>cosmetic — all sites"]
    CS2["youtube.content.ts<br/>skip/seek/mute · ISOLATED"]
    CS3["youtube-main.content.ts<br/>strip ads · MAIN world"]
    DNR[("declarativeNetRequest<br/>static + dynamic rules")]
  end

  subgraph core["src/core — pure & unit-tested"]
    YT["youtube/ad-state<br/>youtube/strip-ads"]
    BL["blocking/allowlist<br/>blocking/stats"]
    COS["cosmetic/rules"]
  end

  SHARED["src/shared<br/>settings · storage (port) · messages"]

  RULES -. bundled .-> DNR
  POP <--> SW
  SW --> DNR
  SW --> BL
  POP --> SHARED
  SW --> SHARED
  CS1 --> COS
  CS2 --> YT
  CS3 --> YT
```

### Why YouTube needs a different strategy

DNR can't block YouTube video ads (same domains as the video), and blocking
*anything* on YouTube trips the anti-adblock wall. So we let all YouTube requests
through and strip ads from the player response before the player reads them.

```mermaid
sequenceDiagram
  autonumber
  participant P as YouTube page
  participant M as MAIN-world hook<br/>(youtube-main)
  participant N as DNR
  participant U as User

  Note over N: allow rule on youtube.com<br/>→ nothing blocked → no wall
  P->>P: fetch /youtubei/v1/player
  P->>M: Response.json() / JSON.parse()
  M->>M: stripPlayerResponseAds()<br/>drop adPlacements, playerAds, adSlots…
  M-->>P: player response with no ads
  P->>U: video plays — no ad, no wall
```

### Request handling on a normal site

```mermaid
flowchart LR
  R(["request"]) --> A{site allowlisted?}
  A -- yes --> PASS["allow<br/>(dynamic rule)"]
  A -- no --> B{matches EasyList /<br/>EasyPrivacy / curated?}
  B -- yes --> BLK["block + count"]
  B -- no --> PASS2["allow"]
  PASS2 --> COSM["cosmetic CSS hides<br/>leftover banners"]
```

### Settings (persisted via `chrome.storage`)

```ts
type Settings = {
  enabled: boolean            // global on/off
  allowlist: string[]         // registrable domains exempt from blocking
  youtube: { enabled: boolean }
  cosmetic: { enabled: boolean }
}
```

## Requirements
- Node 24 (via fnm — see `.node-version`) and pnpm (`corepack pnpm`).

## Development
```bash
corepack pnpm install      # install deps (+ wxt prepare)
corepack pnpm run rules    # download EasyList/EasyPrivacy → src/public/rules/*.json
corepack pnpm test         # run the core unit tests
corepack pnpm run build    # generate rules + build the extension into .output/chrome-mv3
corepack pnpm dev          # dev mode with HMR
```
> If pnpm complains about "ignored build scripts", the esbuild binary already
> ships via its platform package; run the commands through
> `./node_modules/.bin/<cmd>` or approve them with `pnpm approve-builds`.

## Load it in the browser (unpacked)
1. `corepack pnpm run build`
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the `.output/chrome-mv3` folder.
   > It's a hidden folder (leading dot). In the macOS file dialog press
   > `⌘ + Shift + .` to reveal hidden folders, or `⌘ + Shift + G` and paste the
   > full path.

After editing code, run the build again and click the ↻ (reload) button on the
extension card, or use `corepack pnpm dev` for auto-reload.

## Notes & limits
- Chrome guarantees **30,000 enabled static rules**; the caps in
  `scripts/build-rules.ts` keep the total (~29k) under that so every ruleset
  loads reliably. The script reports how many rules were dropped (no silent
  truncation).
- Blocking YouTube ads is a cat-and-mouse game: when YouTube changes its player,
  adjust the selectors in `src/core/cosmetic/rules.ts` and the logic in
  `src/core/youtube/` (covered by tests).
- If the wall sticks around after a fix, clear youtube.com site data
  (DevTools → Application → Clear site data, which also clears the service
  worker) and hard-reload.
- Possible v2: whole-network DNS layer, ingest EasyList cosmetic rules at build
  time, periodic filter-list updates.

## Project structure
```
src/core/         pure, testable domain (youtube, blocking, cosmetic, filters)
src/shared/       settings, storage (port), typed message contracts
src/entrypoints/  background, content, youtube(.content/-main), popup (adapters)
src/public/rules/ DNR rulesets (curated is versioned; easylist/easyprivacy generated)
scripts/          build-rules.ts (filter lists → DNR)
tests/            core specs
```
