/**
 * Typed wrapper over chrome.storage.local for Settings — the persistence "port".
 * Keeping all chrome.storage access here means the rest of the code depends on a
 * small typed surface, not on the browser API directly.
 */
import { DEFAULT_SETTINGS, type Settings } from './settings';

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(KEY);
  const stored = raw[KEY] as Partial<Settings> | undefined;
  // Merge with defaults so new fields added later are always present.
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    youtube: { ...DEFAULT_SETTINGS.youtube, ...stored?.youtube },
    cosmetic: { ...DEFAULT_SETTINGS.cosmetic, ...stored?.cosmetic },
    allowlist: stored?.allowlist ?? DEFAULT_SETTINGS.allowlist,
  };
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export async function updateSettings(
  patch: (current: Settings) => Settings,
): Promise<Settings> {
  const next = patch(await getSettings());
  await setSettings(next);
  return next;
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function onSettingsChanged(cb: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Settings) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
