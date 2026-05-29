import { describe, it, expect } from 'vitest';
import { stripPlayerResponseAds } from '@/core/youtube/strip-ads';

describe('stripPlayerResponseAds', () => {
  it('removes ad keys from a player response', () => {
    const resp = {
      playabilityStatus: { status: 'OK' },
      streamingData: { formats: [] },
      adPlacements: [{ id: 1 }],
      playerAds: [{ id: 2 }],
      adSlots: [{ id: 3 }],
      adBreakHeartbeatParams: 'x',
    };
    const out = stripPlayerResponseAds(resp);
    expect(out).not.toHaveProperty('adPlacements');
    expect(out).not.toHaveProperty('playerAds');
    expect(out).not.toHaveProperty('adSlots');
    expect(out).not.toHaveProperty('adBreakHeartbeatParams');
    // Non-ad data is preserved.
    expect(out.playabilityStatus).toEqual({ status: 'OK' });
    expect(out.streamingData).toEqual({ formats: [] });
  });

  it('strips ads from a nested playerResponse wrapper', () => {
    const resp = { playerResponse: { adPlacements: [1], streamingData: {} } };
    stripPlayerResponseAds(resp);
    expect(resp.playerResponse).not.toHaveProperty('adPlacements');
  });

  it('leaves JSON without player-response markers untouched', () => {
    const other = { foo: 'bar', list: [1, 2, 3], nested: { a: 1 } };
    const out = stripPlayerResponseAds(other);
    expect(out).toEqual({ foo: 'bar', list: [1, 2, 3], nested: { a: 1 } });
  });

  it('passes through primitives and null safely', () => {
    expect(stripPlayerResponseAds(null)).toBeNull();
    expect(stripPlayerResponseAds(42)).toBe(42);
    expect(stripPlayerResponseAds('s')).toBe('s');
  });
});
