/** User-facing settings shape and defaults. Persisted via shared/storage.ts. */

export interface Settings {
  /** Master on/off switch for all blocking. */
  enabled: boolean;
  /** Registrable domains exempt from blocking. */
  allowlist: string[];
  /** YouTube ad-removal content script enabled. */
  youtube: { enabled: boolean };
  /** Generic cosmetic element-hiding enabled. */
  cosmetic: { enabled: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  allowlist: [],
  youtube: { enabled: true },
  cosmetic: { enabled: true },
};

/** IDs of the static DNR rulesets declared in the manifest. */
export const STATIC_RULESET_IDS = ['curated', 'easylist', 'easyprivacy'] as const;
export type StaticRulesetId = (typeof STATIC_RULESET_IDS)[number];
