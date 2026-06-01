import { defineContentScript } from 'wxt/sandbox';
import { isAllowlisted } from '@/core/blocking/allowlist';
import { GENERIC_HIDE_SELECTORS, buildHideCss } from '@/core/cosmetic/rules';
import { getSettings } from '@/shared/storage';
import { sendMessage } from '@/shared/messages';

/**
 * Generic cosmetic filtering for every site: inject a stylesheet that hides
 * common ad containers. Network blocking (DNR) handles the requests; this hides
 * the leftover empty frames/banners that DNR can't remove from the layout.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  async main() {
    const settings = await getSettings();
    if (!settings.enabled || !settings.cosmetic.enabled) return;
    if (isAllowlisted(location.hostname, settings.allowlist)) return;
    // Never inject ad-hiding CSS on YouTube: any display:none on ad containers
    // trips YouTube's anti-adblock wall. YouTube ads are handled by skip/seek in
    // youtube.content.ts instead. See the note there for the full rationale.
    if (/(^|\.)youtube\.com$/.test(location.hostname)) return;

    const style = document.createElement('style');
    style.id = 'full-blocker-cosmetic';
    style.textContent = buildHideCss(GENERIC_HIDE_SELECTORS);
    (document.head ?? document.documentElement).appendChild(style);

    // Best-effort badge feedback: count matched elements once the DOM settles.
    const report = () => {
      const hidden = document.querySelectorAll(GENERIC_HIDE_SELECTORS.join(',')).length;
      if (hidden > 0) void sendMessage({ type: 'COSMETIC_TICK', count: hidden });
    };
    if (document.readyState === 'complete') report();
    else window.addEventListener('load', report, { once: true });
  },
});
