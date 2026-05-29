/**
 * Pure decision logic for YouTube ad handling.
 *
 * No DOM, no chrome.* — given a snapshot of the player state, decide what to do.
 * This is the part that breaks when YouTube changes its player, so it is kept
 * isolated and fully unit-tested. The content script (adapter) is responsible
 * for building the snapshot from the DOM and executing the chosen action.
 */

export interface PlayerSnapshot {
  /** True when an in-stream (video) ad is currently playing. */
  adShowing: boolean;
  /** True when a "Skip Ad" button is present and clickable. */
  skippable: boolean;
  /** Current playback time of the ad, in seconds. */
  currentTime: number;
  /** Total duration of the ad, in seconds (NaN/0 if unknown). */
  duration: number;
}

export type AdAction =
  /** Click the skip button now. */
  | { kind: 'SKIP' }
  /** Seek the ad video to its end to get past an unskippable ad. */
  | { kind: 'SEEK_TO_END'; to: number }
  /** Nothing actionable yet (e.g. ad showing but not skippable and duration unknown). */
  | { kind: 'NONE' };

/**
 * Decide the action for the current player snapshot.
 *
 * Priority:
 *  1. If a skip button is available, skip immediately.
 *  2. If an unskippable ad is playing and we know its duration, seek to the end
 *     (a hair before duration to force YouTube to advance to the content).
 *  3. Otherwise do nothing.
 */
export function decideAdAction(s: PlayerSnapshot): AdAction {
  if (!s.adShowing) return { kind: 'NONE' };
  if (s.skippable) return { kind: 'SKIP' };

  const hasDuration = Number.isFinite(s.duration) && s.duration > 0;
  if (hasDuration && s.currentTime < s.duration) {
    // Seek just shy of the end; YouTube advances reliably from there.
    return { kind: 'SEEK_TO_END', to: Math.max(0, s.duration - 0.1) };
  }
  return { kind: 'NONE' };
}

/**
 * Whether audio should be muted given the snapshot. We mute during any ad and
 * unmute once it's gone, so the user never hears ad audio while we fast-forward.
 */
export function shouldMuteForAd(s: PlayerSnapshot): boolean {
  return s.adShowing;
}
