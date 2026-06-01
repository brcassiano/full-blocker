/**
 * Generic cosmetic (element-hiding) selectors applied across all sites. v1 ships
 * a curated list; v2 can ingest EasyList cosmetic rules generated at build time.
 *
 * Kept as plain data so it can be unit-tested for sanity (no empty/duplicate
 * selectors) and reused by the content scripts.
 *
 * Note: there is deliberately NO YouTube-specific selector set. Hiding YouTube ad
 * containers trips its anti-adblock wall (see youtube.content.ts), so cosmetic
 * filtering is skipped entirely on youtube.com.
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

/** Build a single CSS rule that hides every selector in the list. */
export function buildHideCss(selectors: readonly string[]): string {
  if (selectors.length === 0) return '';
  return `${selectors.join(',\n')} { display: none !important; }`;
}
