/**
 * Remove ad data from a YouTube player response — pure and testable.
 *
 * This is the lever that defeats YouTube's anti-adblock wall: instead of
 * blocking ad *requests* (which YouTube detects and reacts to with the "ad
 * blockers violate ToS" wall), we delete the ad descriptors from the player
 * response before the player reads them. With no ads to play, the player never
 * fetches ad segments, so nothing is "blocked" and no wall is shown.
 *
 * The injected MAIN-world hook calls this on parsed player responses; this file
 * stays free of DOM/chrome APIs so it can be unit-tested.
 */

/** Ad-bearing keys that live on a YouTube player response object. */
const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'] as const;

/** Heuristic: does this object look like a player response (worth scanning)? */
function looksLikePlayerResponse(obj: Record<string, unknown>): boolean {
  return (
    'playerAds' in obj ||
    'adPlacements' in obj ||
    'adSlots' in obj ||
    'streamingData' in obj ||
    'playabilityStatus' in obj
  );
}

/**
 * Strip ad descriptors from `data` in place (and from a nested `playerResponse`
 * wrapper, which some endpoints use). Returns the same reference for convenience.
 * Cheap for non-player JSON: only objects that look like player responses are
 * touched, so it's safe to call from a hot JSON.parse hook.
 */
export function stripPlayerResponseAds<T>(data: T): T {
  if (data === null || typeof data !== 'object') return data;
  const obj = data as Record<string, unknown>;

  if (looksLikePlayerResponse(obj)) {
    for (const key of AD_KEYS) {
      if (key in obj) delete obj[key];
    }
  }

  const wrapped = obj.playerResponse;
  if (wrapped && typeof wrapped === 'object') {
    stripPlayerResponseAds(wrapped);
  }

  return data;
}
