import { defineContentScript } from 'wxt/sandbox';
import { decideAdAction, shouldMuteForAd, type PlayerSnapshot } from '@/core/youtube/ad-state';
import { isAllowlisted } from '@/core/blocking/allowlist';
import { getSettings } from '@/shared/storage';

/**
 * YouTube ad handler. DNR cannot block YouTube video ads (they share domains with
 * the real video), so we act inside the page: read the player state, ask the pure
 * decider what to do, and execute it (skip / fast-forward / mute).
 *
 * IMPORTANT — why we only skip, never *remove*: YouTube's anti-adblock detects
 * any attempt to make ads not exist. Both stripping ads from the player response
 * AND hiding ad containers with `display:none` are detected and trigger the "ad
 * blockers violate ToS" wall (the server then 403s every videoplayback request).
 * The only approach that survives is letting the ad load and play, then skipping
 * or fast-forwarding it — YouTube just sees a very fast "skip" click, which it
 * does not treat as ad blocking. So this file does NOT inject ad-hiding CSS and
 * there is no player-response strip; that is a deliberate, hard-won constraint.
 */
export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  async main() {
    const settings = await getSettings();
    if (!settings.enabled || !settings.youtube.enabled) return;
    if (isAllowlisted(location.hostname, settings.allowlist)) return;

    let mutedByUs = false;

    const snapshot = (): PlayerSnapshot | null => {
      const player = document.querySelector<HTMLElement>('.html5-video-player');
      const video = document.querySelector<HTMLVideoElement>('.html5-main-video');
      if (!player || !video) return null;
      const skipBtn = document.querySelector<HTMLElement>(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button',
      );
      return {
        adShowing: player.classList.contains('ad-showing'),
        skippable: !!skipBtn,
        currentTime: video.currentTime,
        duration: video.duration,
      };
    };

    const tick = () => {
      const snap = snapshot();
      if (!snap) return;
      const video = document.querySelector<HTMLVideoElement>('.html5-main-video');
      if (!video) return;

      // Mute/unmute around ads so we never hear the fast-forwarded ad.
      const wantMute = shouldMuteForAd(snap);
      if (wantMute && !video.muted) {
        video.muted = true;
        mutedByUs = true;
      } else if (!wantMute && mutedByUs) {
        video.muted = false;
        mutedByUs = false;
      }

      const action = decideAdAction(snap);
      if (action.kind === 'SKIP') {
        document
          .querySelector<HTMLElement>(
            '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button',
          )
          ?.click();
      } else if (action.kind === 'SEEK_TO_END') {
        video.currentTime = action.to;
      }
    };

    // React to player DOM changes and also poll as a fallback (player mutates a lot).
    const observer = new MutationObserver(() => tick());
    const start = () => {
      const root = document.querySelector('#movie_player') ?? document.body;
      if (root) observer.observe(root, { attributes: true, childList: true, subtree: true });
      tick();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
    setInterval(tick, 500);
  },
});
