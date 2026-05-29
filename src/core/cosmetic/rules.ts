/**
 * Generic cosmetic (element-hiding) selectors applied across all sites, plus a
 * dedicated set for YouTube. v1 ships a curated list; v2 can ingest EasyList
 * cosmetic rules generated at build time.
 *
 * Kept as plain data so it can be unit-tested for sanity (no empty/duplicate
 * selectors) and reused by the content scripts.
 */

/** Selectors hidden everywhere. Conservative to avoid breaking legit layout. */
export const GENERIC_HIDE_SELECTORS: readonly string[] = [
  '[id^="google_ads_"]',
  '[id^="div-gpt-ad"]',
  'ins.adsbygoogle',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[id^="aswift_"]',
  '[class*="ad-banner"]',
  '[class*="advertisement"]',
  '[data-ad-slot]',
  '[aria-label="advertisement" i]',
];

/** Selectors hidden only on youtube.com (overlays, banners, promoted feed). */
export const YOUTUBE_HIDE_SELECTORS: readonly string[] = [
  '.video-ads',
  '.ytp-ad-module',
  '.ytp-ad-overlay-container',
  '.ytp-ad-image-overlay',
  'ytd-display-ad-renderer',
  'ytd-ad-slot-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-promoted-video-renderer',
  '#masthead-ad',
  '#player-ads',
  'ytd-companion-slot-renderer',
];

/** Build a single CSS rule that hides every selector in the list. */
export function buildHideCss(selectors: readonly string[]): string {
  if (selectors.length === 0) return '';
  return `${selectors.join(',\n')} { display: none !important; }`;
}
