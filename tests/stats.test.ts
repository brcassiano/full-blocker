import { describe, it, expect } from 'vitest';
import { TabStatsStore, formatBadge } from '@/core/blocking/stats';

describe('TabStatsStore', () => {
  it('accumulates totals per tab and resets independently', () => {
    const s = new TabStatsStore();
    expect(s.record(1, 'ads.com')).toBe(1);
    expect(s.record(1, 'ads.com', 4)).toBe(5);
    expect(s.record(2, 'track.com')).toBe(1);
    expect(s.get(1)).toBe(5);
    s.reset(1);
    expect(s.get(1)).toBe(0);
    expect(s.get(2)).toBe(1);
  });

  it('builds a breakdown sorted by count, highest first', () => {
    const s = new TabStatsStore();
    s.record(1, 'doubleclick.net');
    s.record(1, 'ads.com', 3);
    s.record(1, 'doubleclick.net');
    expect(s.breakdown(1)).toEqual([
      { label: 'ads.com', count: 3 },
      { label: 'doubleclick.net', count: 2 },
    ]);
  });

  it('returns an empty breakdown for unknown tabs', () => {
    expect(new TabStatsStore().breakdown(99)).toEqual([]);
  });
});

describe('formatBadge', () => {
  it('formats counts for the badge', () => {
    expect(formatBadge(0)).toBe('');
    expect(formatBadge(42)).toBe('42');
    expect(formatBadge(1500)).toBe('1.5k');
    expect(formatBadge(99999)).toBe('9k+');
  });
});
