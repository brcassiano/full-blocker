import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  isAllowlisted,
  addToAllowlist,
  removeFromAllowlist,
  toggleAllowlist,
} from '@/core/blocking/allowlist';

describe('normalizeDomain', () => {
  it('lowercases and strips scheme, port and path', () => {
    expect(normalizeDomain('HTTPS://Example.com:8080/path?q=1')).toBe('example.com');
  });
  it('accepts bare hostnames', () => {
    expect(normalizeDomain('  www.Example.COM. ')).toBe('www.example.com');
  });
});

describe('isAllowlisted', () => {
  it('matches exact and subdomains', () => {
    const list = ['example.com'];
    expect(isAllowlisted('example.com', list)).toBe(true);
    expect(isAllowlisted('www.example.com', list)).toBe(true);
    expect(isAllowlisted('sub.deep.example.com', list)).toBe(true);
  });
  it('does not match unrelated or partial domains', () => {
    const list = ['example.com'];
    expect(isAllowlisted('notexample.com', list)).toBe(false);
    expect(isAllowlisted('example.com.evil.com', list)).toBe(false);
  });
});

describe('mutations', () => {
  it('adds idempotently and is immutable', () => {
    const a = addToAllowlist('Example.com', []);
    const b = addToAllowlist('example.com', a);
    expect(a).toEqual(['example.com']);
    expect(b).toEqual(['example.com']);
    expect(b).not.toBe(a);
  });
  it('removes by normalized domain', () => {
    expect(removeFromAllowlist('EXAMPLE.com', ['example.com', 'other.com'])).toEqual([
      'other.com',
    ]);
  });
  it('toggles in and out', () => {
    const on = toggleAllowlist('example.com', []);
    expect(on).toEqual(['example.com']);
    expect(toggleAllowlist('example.com', on)).toEqual([]);
  });
});
