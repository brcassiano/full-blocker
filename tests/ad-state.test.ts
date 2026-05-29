import { describe, it, expect } from 'vitest';
import { decideAdAction, shouldMuteForAd } from '@/core/youtube/ad-state';

describe('decideAdAction', () => {
  it('does nothing when no ad is showing', () => {
    expect(
      decideAdAction({ adShowing: false, skippable: false, currentTime: 5, duration: 100 }),
    ).toEqual({ kind: 'NONE' });
  });

  it('skips when a skip button is available', () => {
    expect(
      decideAdAction({ adShowing: true, skippable: true, currentTime: 3, duration: 30 }),
    ).toEqual({ kind: 'SKIP' });
  });

  it('seeks to end for an unskippable ad with known duration', () => {
    const action = decideAdAction({
      adShowing: true,
      skippable: false,
      currentTime: 1,
      duration: 15,
    });
    expect(action).toEqual({ kind: 'SEEK_TO_END', to: 14.9 });
  });

  it('does nothing for an unskippable ad with unknown duration', () => {
    expect(
      decideAdAction({ adShowing: true, skippable: false, currentTime: 0, duration: NaN }),
    ).toEqual({ kind: 'NONE' });
  });

  it('does nothing once the ad has effectively ended', () => {
    expect(
      decideAdAction({ adShowing: true, skippable: false, currentTime: 15, duration: 15 }),
    ).toEqual({ kind: 'NONE' });
  });
});

describe('shouldMuteForAd', () => {
  it('mutes during ads and not otherwise', () => {
    expect(
      shouldMuteForAd({ adShowing: true, skippable: false, currentTime: 1, duration: 10 }),
    ).toBe(true);
    expect(
      shouldMuteForAd({ adShowing: false, skippable: false, currentTime: 1, duration: 10 }),
    ).toBe(false);
  });
});
