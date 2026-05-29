import { defineContentScript } from 'wxt/sandbox';
import { stripPlayerResponseAds } from '@/core/youtube/strip-ads';

/**
 * Runs in the page's MAIN world (same JS context as YouTube) at document_start,
 * so it can patch the globals the player uses to read its ad data. By removing
 * ads from the player response *before* the player sees them, YouTube never
 * tries to fetch ad segments — so nothing is blocked and the "ad blockers
 * violate ToS" wall is not triggered.
 *
 * Note: MAIN-world scripts have no access to chrome.* APIs, so this can't read
 * the allowlist; it always strips ads on youtube.com. That's a low-risk tradeoff
 * (it only removes ads). The ISOLATED youtube.content.ts handles skip/seek/CSS.
 */
export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    // 1) Player data fetched via fetch() -> Response.json() (/youtubei/v1/player).
    const origJson = Response.prototype.json;
    Response.prototype.json = async function patchedJson() {
      const data = await origJson.call(this);
      try {
        return stripPlayerResponseAds(data);
      } catch {
        return data;
      }
    };

    // 2) Some paths run the body through JSON.parse directly.
    const origParse = JSON.parse;
    JSON.parse = function patchedParse(text: string, reviver?: Parameters<typeof origParse>[1]) {
      const data = origParse.call(JSON, text, reviver);
      try {
        return stripPlayerResponseAds(data);
      } catch {
        return data;
      }
    };

    // 3) The initial watch-page response assigned inline as window.ytInitialPlayerResponse.
    let cached: unknown;
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        get() {
          return cached;
        },
        set(value: unknown) {
          cached = stripPlayerResponseAds(value);
        },
      });
    } catch {
      /* another script may have locked the property; ignore */
    }
  },
});
