/**
 * Typed message contracts between popup/content scripts and the background
 * service worker. A single discriminated union keeps both ends in sync.
 */
import type { Settings } from './settings';
import type { BlockedEntry } from '@/core/blocking/stats';

export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'TOGGLE_ALLOWLIST'; domain: string }
  | { type: 'GET_TAB_STATS'; tabId: number }
  | { type: 'COSMETIC_TICK'; count: number };

export interface MessageResult {
  GET_SETTINGS: Settings;
  SET_ENABLED: Settings;
  TOGGLE_ALLOWLIST: Settings;
  GET_TAB_STATS: { tabId: number; blocked: number; items: BlockedEntry[] };
  COSMETIC_TICK: void;
}

/** Send a typed message to the background worker and await its reply. */
export async function sendMessage<T extends Message['type']>(
  message: Extract<Message, { type: T }>,
): Promise<MessageResult[T]> {
  return (await chrome.runtime.sendMessage(message)) as MessageResult[T];
}
