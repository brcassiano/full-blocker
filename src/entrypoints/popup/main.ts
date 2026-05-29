import { normalizeDomain, isAllowlisted } from '@/core/blocking/allowlist';
import { sendMessage } from '@/shared/messages';
import type { BlockedEntry } from '@/core/blocking/stats';

/** Render the per-tab breakdown of blocked requests / hidden elements. */
function renderBlockedList(items: BlockedEntry[] = []) {
  const list = document.getElementById('blocked-list') as HTMLUListElement;
  const empty = document.getElementById('blocked-empty') as HTMLParagraphElement;
  list.replaceChildren();

  if (items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const item of items) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.label;
    label.title = item.label;
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = String(item.count);
    li.append(label, count);
    list.appendChild(li);
  }
}

/** Popup controller: reflects Settings + tab stats and writes changes back. */
async function init() {
  const enabledEl = document.getElementById('enabled') as HTMLInputElement;
  const allowEl = document.getElementById('allow-site') as HTMLInputElement;
  const countEl = document.getElementById('count') as HTMLSpanElement;
  const hostEl = document.getElementById('site-host') as HTMLParagraphElement;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab?.url ? normalizeDomain(tab.url) : '';
  hostEl.textContent = host || '—';

  const settings = await sendMessage({ type: 'GET_SETTINGS' });
  enabledEl.checked = settings.enabled;
  allowEl.checked = !!host && isAllowlisted(host, settings.allowlist);
  allowEl.disabled = !host;

  // Wire the controls first, so a later stats failure can never disable them.
  enabledEl.addEventListener('change', async () => {
    await sendMessage({ type: 'SET_ENABLED', enabled: enabledEl.checked });
    reloadActiveTab(tab);
  });

  allowEl.addEventListener('change', async () => {
    if (!host) return;
    await sendMessage({ type: 'TOGGLE_ALLOWLIST', domain: host });
    reloadActiveTab(tab);
  });

  // Stats are best-effort: never let them break the popup.
  if (tab?.id !== undefined) {
    try {
      const stats = await sendMessage({ type: 'GET_TAB_STATS', tabId: tab.id });
      countEl.textContent = String(stats?.blocked ?? 0);
      renderBlockedList(stats?.items);
    } catch {
      renderBlockedList([]);
    }
  }
}

/** Allowlist/enabled changes only take effect after the page reloads. */
function reloadActiveTab(tab: chrome.tabs.Tab | undefined) {
  if (tab?.id !== undefined) chrome.tabs.reload(tab.id);
  window.close();
}

void init();
