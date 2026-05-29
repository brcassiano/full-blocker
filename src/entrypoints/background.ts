import { defineBackground } from 'wxt/sandbox';
import { isAllowlisted, normalizeDomain } from '@/core/blocking/allowlist';
import { TabStatsStore, formatBadge } from '@/core/blocking/stats';
import { STATIC_RULESET_IDS, type Settings } from '@/shared/settings';
import { getSettings, onSettingsChanged, updateSettings } from '@/shared/storage';
import type { Message, MessageResult } from '@/shared/messages';
import { addToAllowlist, removeFromAllowlist } from '@/core/blocking/allowlist';

/**
 * Service worker: the only place that touches declarativeNetRequest and the
 * action badge. It reconciles browser state from Settings:
 *  - master toggle  -> enable/disable the static rulesets
 *  - allowlist      -> one dynamic `allowAllRequests` rule per domain
 * and keeps a per-tab block counter for the badge.
 */
/** Extract the hostname from a request URL for the per-tab breakdown. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export default defineBackground(() => {
  const stats = new TabStatsStore();

  // All our dynamic rules live at/above this id so we can replace them wholesale.
  const DYNAMIC_RULE_BASE = 1_000_000;
  // Fixed id for the YouTube network-exception rule.
  const YOUTUBE_RULE_ID = 2_000_000;
  // Never run DNR network blocking on these — it only trips YouTube's
  // anti-adblock wall (DNR can't block same-domain video ads anyway). YouTube
  // ad removal is handled client-side by the strip + skip content scripts.
  const YOUTUBE_DOMAINS = ['youtube.com', 'youtube-nocookie.com', 'youtubekids.com', 'youtu.be'];

  const FRAME_TYPES = [
    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
  ];

  async function reconcileRulesets(settings: Settings): Promise<void> {
    const ids = [...STATIC_RULESET_IDS];
    await chrome.declarativeNetRequest.updateEnabledRulesets(
      settings.enabled
        ? { enableRulesetIds: ids, disableRulesetIds: [] }
        : { enableRulesetIds: [], disableRulesetIds: ids },
    );
  }

  async function reconcileDynamicRules(settings: Settings): Promise<void> {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .filter((r) => r.id >= DYNAMIC_RULE_BASE)
      .map((r) => r.id);

    // User allowlist: allow all requests on each allowlisted site.
    const addRules: chrome.declarativeNetRequest.Rule[] = settings.allowlist.map(
      (domain, i) => ({
        id: DYNAMIC_RULE_BASE + i,
        priority: 10_000, // outrank blocking rules
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS },
        condition: { requestDomains: [normalizeDomain(domain)], resourceTypes: FRAME_TYPES },
      }),
    );

    // YouTube network exception (always on while blocking is enabled). An `allow`
    // rule keyed on initiatorDomains lets through every request a YouTube page
    // makes (googlevideo, ytimg, doubleclick pings, etc.), so DNR blocks nothing
    // there and the anti-adblock wall isn't triggered. Ad removal on YouTube is
    // done client-side by the strip + skip content scripts instead.
    if (settings.enabled) {
      addRules.push({
        id: YOUTUBE_RULE_ID,
        priority: 20_000, // outrank every static block rule
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
        condition: { initiatorDomains: YOUTUBE_DOMAINS }, // all resource types
      });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  }

  async function reconcileAll(settings: Settings): Promise<void> {
    await Promise.all([reconcileRulesets(settings), reconcileDynamicRules(settings)]);
  }

  async function refreshBadge(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: formatBadge(stats.get(tabId)) });
  }

  // ---- lifecycle ---------------------------------------------------------
  chrome.runtime.onInstalled.addListener(async () => {
    await chrome.action.setBadgeBackgroundColor({ color: '#d33' });
    await reconcileAll(await getSettings());
  });

  chrome.runtime.onStartup.addListener(async () => {
    await reconcileAll(await getSettings());
  });

  onSettingsChanged((settings) => void reconcileAll(settings));

  // Reconcile on every service-worker startup too (onInstalled/onStartup don't
  // fire when the SW is merely woken up), so the rules are always in sync.
  void getSettings().then(reconcileAll);

  // ---- block counting (badge) -------------------------------------------
  // declarativeNetRequestFeedback fires onRuleMatchedDebug in unpacked/dev builds.
  // Our dynamic rules are `allow`/allowAllRequests exceptions — count only the
  // static rulesets (actual blocks), so the breakdown reflects real blocking.
  const STATIC_RULESETS = new Set<string>(STATIC_RULESET_IDS);
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      const tabId = info.request.tabId;
      if (tabId >= 0 && STATIC_RULESETS.has(info.rule.rulesetId)) {
        stats.record(tabId, hostnameOf(info.request.url));
        void refreshBadge(tabId);
      }
    });
  }

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
      stats.reset(tabId);
      void refreshBadge(tabId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => stats.reset(tabId));

  // ---- messaging ---------------------------------------------------------
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handle(message, sender).then(sendResponse);
    return true; // keep the channel open for the async reply
  });

  async function handle(
    message: Message,
    sender: chrome.runtime.MessageSender,
  ): Promise<MessageResult[Message['type']] | void> {
    switch (message.type) {
      case 'GET_SETTINGS':
        return getSettings();

      case 'SET_ENABLED':
        return updateSettings((s) => ({ ...s, enabled: message.enabled }));

      case 'TOGGLE_ALLOWLIST':
        return updateSettings((s) => ({
          ...s,
          allowlist: isAllowlisted(message.domain, s.allowlist)
            ? removeFromAllowlist(message.domain, s.allowlist)
            : addToAllowlist(message.domain, s.allowlist),
        }));

      case 'GET_TAB_STATS':
        return {
          tabId: message.tabId,
          blocked: stats.get(message.tabId),
          items: stats.breakdown(message.tabId).slice(0, 30),
        };

      case 'COSMETIC_TICK': {
        const tabId = sender.tab?.id;
        if (tabId !== undefined && tabId >= 0) {
          stats.record(tabId, 'page elements hidden', message.count);
          void refreshBadge(tabId);
        }
        return;
      }
    }
  }
});
