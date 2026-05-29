/**
 * Minimal Adblock-Plus (EasyList) → declarativeNetRequest converter.
 *
 * Pure and testable. It handles the *network-rule* subset of ABP syntax that
 * maps cleanly onto DNR's urlFilter grammar (which is deliberately ABP-like).
 * Anything we can't translate safely (cosmetic rules, regex rules, unsupported
 * options) is skipped and counted — we never emit a rule we're unsure about, to
 * avoid breaking pages.
 */

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' | 'allow' };
  condition: {
    urlFilter: string;
    resourceTypes?: string[];
    domainType?: 'firstParty' | 'thirdParty';
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
  };
}

export interface ConvertResult {
  rules: DnrRule[];
  /** Lines skipped because we couldn't translate them safely. */
  skipped: number;
  /** Cosmetic lines skipped (handled separately by content scripts). */
  cosmetic: number;
}

/** ABP option token -> DNR resourceType. */
const RESOURCE_TYPES: Record<string, string> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  subdocument: 'sub_frame',
  object: 'object',
  media: 'media',
  font: 'font',
  ping: 'ping',
  websocket: 'websocket',
  other: 'other',
  document: 'main_frame',
};

/** Options we understand but that don't map to a resourceType. */
const MODIFIER_OPTIONS = new Set(['third-party', '~third-party', 'domain', 'all', 'popup']);

const COSMETIC_MARKERS = ['##', '#@#', '#?#', '#$#', '#%#'];

/** urlFilter must be ASCII; DNR rejects non-ASCII (use regexFilter instead). */
function isAscii(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

function parseOptions(optionStr: string): {
  resourceTypes?: string[];
  domainType?: 'firstParty' | 'thirdParty';
  initiatorDomains?: string[];
  excludedInitiatorDomains?: string[];
  supported: boolean;
} {
  const resourceTypes: string[] = [];
  let domainType: 'firstParty' | 'thirdParty' | undefined;
  let initiatorDomains: string[] | undefined;
  let excludedInitiatorDomains: string[] | undefined;

  for (const rawOpt of optionStr.split(',')) {
    const opt = rawOpt.trim();
    if (opt === '') continue;

    if (opt.startsWith('domain=')) {
      const inc: string[] = [];
      const exc: string[] = [];
      for (const d of opt.slice('domain='.length).split('|')) {
        if (!d) continue;
        if (d.startsWith('~')) exc.push(d.slice(1).toLowerCase());
        else inc.push(d.toLowerCase());
      }
      if (inc.length) initiatorDomains = inc;
      if (exc.length) excludedInitiatorDomains = exc;
      continue;
    }
    if (opt === 'third-party') {
      domainType = 'thirdParty';
      continue;
    }
    if (opt === '~third-party') {
      domainType = 'firstParty';
      continue;
    }
    if (opt === 'all' || opt === 'popup') continue; // harmless to ignore

    const negated = opt.startsWith('~');
    const key = negated ? opt.slice(1) : opt;
    if (key in RESOURCE_TYPES) {
      // We only model the positive case; a negated type is treated as unsupported
      // to stay safe (avoids accidentally widening scope).
      if (negated) return { supported: false };
      resourceTypes.push(RESOURCE_TYPES[key]!);
      continue;
    }
    if (MODIFIER_OPTIONS.has(key)) continue;

    // Unknown / unsupported option (csp, redirect, rewrite, important, ...).
    return { supported: false };
  }

  return {
    supported: true,
    resourceTypes: resourceTypes.length ? resourceTypes : undefined,
    domainType,
    initiatorDomains,
    excludedInitiatorDomains,
  };
}

/** Convert one ABP line to a DnrRule, or null if unsupported/cosmetic. */
export function convertLine(
  line: string,
  id: number,
): { rule: DnrRule | null; cosmetic: boolean } {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('!') || trimmed.startsWith('[')) {
    return { rule: null, cosmetic: false };
  }
  if (COSMETIC_MARKERS.some((m) => trimmed.includes(m))) {
    return { rule: null, cosmetic: true };
  }

  const isException = trimmed.startsWith('@@');
  let body = isException ? trimmed.slice(2) : trimmed;

  // Regex rules (/.../) are not translated in v1.
  if (body.startsWith('/') && body.endsWith('/')) return { rule: null, cosmetic: false };

  const dollar = body.indexOf('$');
  const pattern = dollar === -1 ? body : body.slice(0, dollar);
  const optionStr = dollar === -1 ? '' : body.slice(dollar + 1);

  if (pattern === '' || !isAscii(pattern)) return { rule: null, cosmetic: false };

  const opts = parseOptions(optionStr);
  if (!opts.supported) return { rule: null, cosmetic: false };

  const condition: DnrRule['condition'] = { urlFilter: pattern };
  if (opts.resourceTypes) condition.resourceTypes = opts.resourceTypes;
  if (opts.domainType) condition.domainType = opts.domainType;
  if (opts.initiatorDomains) condition.initiatorDomains = opts.initiatorDomains;
  if (opts.excludedInitiatorDomains)
    condition.excludedInitiatorDomains = opts.excludedInitiatorDomains;

  return {
    rule: {
      id,
      // Exceptions must outrank blocks; keep both below the dynamic allowlist (10000).
      priority: isException ? 2 : 1,
      action: { type: isException ? 'allow' : 'block' },
      condition,
    },
    cosmetic: false,
  };
}

/**
 * Convert a full filter list. `startId` is the first rule id (ids must be unique
 * across all enabled rulesets, so each list gets a distinct range). `maxRules`
 * caps the output; the number dropped by the cap is added to `skipped`.
 */
export function convertFilterList(
  text: string,
  startId: number,
  maxRules = Number.POSITIVE_INFINITY,
): ConvertResult {
  const rules: DnrRule[] = [];
  let skipped = 0;
  let cosmetic = 0;
  let nextId = startId;

  for (const line of text.split('\n')) {
    if (rules.length >= maxRules) {
      // Count the rest of the non-trivial lines as skipped (no silent truncation).
      const t = line.trim();
      if (t && !t.startsWith('!') && !t.startsWith('[')) skipped++;
      continue;
    }
    const { rule, cosmetic: isCosmetic } = convertLine(line, nextId);
    if (isCosmetic) {
      cosmetic++;
    } else if (rule) {
      rules.push(rule);
      nextId++;
    } else if (line.trim() && !line.trim().startsWith('!') && !line.trim().startsWith('[')) {
      skipped++;
    }
  }

  return { rules, skipped, cosmetic };
}
