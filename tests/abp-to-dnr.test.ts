import { describe, it, expect } from 'vitest';
import { convertLine, convertFilterList } from '@/core/filters/abp-to-dnr';

describe('convertLine', () => {
  it('skips comments and section headers', () => {
    expect(convertLine('! comment', 1).rule).toBeNull();
    expect(convertLine('[Adblock Plus 2.0]', 1).rule).toBeNull();
  });

  it('flags cosmetic rules as cosmetic', () => {
    expect(convertLine('example.com##.ad', 1)).toEqual({ rule: null, cosmetic: true });
    expect(convertLine('##.banner', 1).cosmetic).toBe(true);
  });

  it('converts a domain-anchored block rule', () => {
    const { rule } = convertLine('||ads.example.com^', 5);
    expect(rule).toEqual({
      id: 5,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||ads.example.com^' },
    });
  });

  it('maps resource-type and third-party options', () => {
    const { rule } = convertLine('||x.com^$script,third-party', 7);
    expect(rule?.condition.resourceTypes).toEqual(['script']);
    expect(rule?.condition.domainType).toBe('thirdParty');
  });

  it('parses domain= include/exclude into initiator domains', () => {
    const { rule } = convertLine('/ad.js$domain=a.com|~b.com', 9);
    expect(rule?.condition.initiatorDomains).toEqual(['a.com']);
    expect(rule?.condition.excludedInitiatorDomains).toEqual(['b.com']);
  });

  it('converts exceptions to allow rules with higher priority', () => {
    const { rule } = convertLine('@@||good.com^', 3);
    expect(rule?.action.type).toBe('allow');
    expect(rule?.priority).toBe(2);
  });

  it('skips unsupported options', () => {
    expect(convertLine('||x.com^$redirect=noop.js', 1).rule).toBeNull();
    expect(convertLine('||x.com^$csp=...', 1).rule).toBeNull();
  });

  it('skips regex and non-ascii patterns', () => {
    expect(convertLine('/banner\\d+/', 1).rule).toBeNull();
    expect(convertLine('||exämple.com^', 1).rule).toBeNull();
  });
});

describe('convertFilterList', () => {
  const list = [
    '! title',
    '||ads.com^',
    'example.com##.ad',
    '||track.com^$image',
    '||x.com^$redirect=noop',
    '',
  ].join('\n');

  it('assigns sequential ids from startId and counts buckets', () => {
    const { rules, skipped, cosmetic } = convertFilterList(list, 1000);
    expect(rules.map((r) => r.id)).toEqual([1000, 1001]);
    expect(cosmetic).toBe(1);
    expect(skipped).toBe(1); // the redirect rule
  });

  it('respects maxRules and counts the overflow as skipped', () => {
    const { rules, skipped } = convertFilterList(list, 1000, 1);
    expect(rules).toHaveLength(1);
    expect(skipped).toBeGreaterThanOrEqual(1);
  });
});
