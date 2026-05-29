/**
 * Per-tab block accounting — pure, testable. The background worker owns an
 * instance, records each block (by domain/label), renders the total to the
 * action badge, and serves the breakdown to the popup.
 */

export interface BlockedEntry {
  /** Domain of a blocked request, or a label like "page elements hidden". */
  label: string;
  count: number;
}

export class TabStatsStore {
  private totals = new Map<number, number>();
  private breakdowns = new Map<number, Map<string, number>>();

  /** Record `by` blocks attributed to `label` (a domain or a category). */
  record(tabId: number, label: string, by = 1): number {
    const total = (this.totals.get(tabId) ?? 0) + by;
    this.totals.set(tabId, total);

    let perLabel = this.breakdowns.get(tabId);
    if (!perLabel) {
      perLabel = new Map();
      this.breakdowns.set(tabId, perLabel);
    }
    perLabel.set(label, (perLabel.get(label) ?? 0) + by);
    return total;
  }

  get(tabId: number): number {
    return this.totals.get(tabId) ?? 0;
  }

  /** Labels with their counts, highest first. */
  breakdown(tabId: number): BlockedEntry[] {
    const perLabel = this.breakdowns.get(tabId);
    if (!perLabel) return [];
    return [...perLabel.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  reset(tabId: number): void {
    this.totals.delete(tabId);
    this.breakdowns.delete(tabId);
  }

  clearAll(): void {
    this.totals.clear();
    this.breakdowns.clear();
  }
}

/** Format a count for the badge (Chrome badges hold ~4 chars). */
export function formatBadge(count: number): string {
  if (count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return '9k+';
}
