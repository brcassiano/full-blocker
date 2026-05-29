/**
 * Allowlist domain logic — pure, testable. The allowlist stores registrable
 * domains; a page is allowlisted when its hostname equals or is a subdomain of
 * any stored entry (so allowlisting `example.com` also covers `www.example.com`).
 */

/** Normalize a hostname or URL into a bare, lowercased hostname (no port/path). */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  // Accept full URLs as well as bare hostnames.
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname;
    } catch {
      /* fall through and treat as raw */
    }
  }
  // Strip leading scheme-less "www." duplicates and any trailing dot/port.
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  return host;
}

/** True when `hostname` is covered by an allowlist entry. */
export function isAllowlisted(hostname: string, allowlist: readonly string[]): boolean {
  const host = normalizeDomain(hostname);
  return allowlist.some((entry) => {
    const e = normalizeDomain(entry);
    return host === e || host.endsWith(`.${e}`);
  });
}

/** Add a domain to the allowlist (idempotent). Returns a new array. */
export function addToAllowlist(domain: string, allowlist: readonly string[]): string[] {
  const d = normalizeDomain(domain);
  if (!d) return [...allowlist];
  if (allowlist.some((e) => normalizeDomain(e) === d)) return [...allowlist];
  return [...allowlist, d];
}

/** Remove a domain from the allowlist. Returns a new array. */
export function removeFromAllowlist(domain: string, allowlist: readonly string[]): string[] {
  const d = normalizeDomain(domain);
  return allowlist.filter((e) => normalizeDomain(e) !== d);
}

/** Toggle a domain in/out of the allowlist. Returns a new array. */
export function toggleAllowlist(domain: string, allowlist: readonly string[]): string[] {
  return isAllowlisted(domain, allowlist)
    ? removeFromAllowlist(domain, allowlist)
    : addToAllowlist(domain, allowlist);
}
