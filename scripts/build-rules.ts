/**
 * Build-time generator: download EasyList + EasyPrivacy and convert them to
 * declarativeNetRequest static rulesets under src/rules/.
 *
 * Run with: pnpm run rules
 *
 * Rule-id ranges are kept disjoint per list (ids must be unique across all
 * enabled rulesets). curated.json uses 1..999 and is hand-maintained.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { convertFilterList } from '../src/core/filters/abp-to-dnr';

// Generated rulesets must live under the WXT public dir so they are copied to
// the extension output root (where the manifest's rule_resources paths resolve).
const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'public', 'rules');

interface ListSpec {
  name: 'easylist' | 'easyprivacy';
  url: string;
  startId: number;
  maxRules: number;
}

// Disjoint id ranges. Chrome guarantees 30,000 ENABLED static rules across all
// rulesets; caps below keep the total (+curated) under that so every ruleset
// loads reliably. Raise them only if you confirm the user's Chrome has headroom.
const LISTS: ListSpec[] = [
  {
    name: 'easylist',
    url: 'https://easylist.to/easylist/easylist.txt',
    startId: 1_000,
    maxRules: 20_000,
  },
  {
    name: 'easyprivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    startId: 100_000,
    maxRules: 9_000,
  },
];

async function buildList(spec: ListSpec): Promise<void> {
  process.stdout.write(`↓ ${spec.name}: fetching ${spec.url}\n`);
  const res = await fetch(spec.url);
  if (!res.ok) throw new Error(`${spec.name}: HTTP ${res.status}`);
  const text = await res.text();

  const { rules, skipped, cosmetic } = convertFilterList(text, spec.startId, spec.maxRules);
  const out = join(RULES_DIR, `${spec.name}.json`);
  await writeFile(out, JSON.stringify(rules, null, 0));

  process.stdout.write(
    `✓ ${spec.name}: ${rules.length} rules → ${out}\n` +
      `  (skipped ${skipped} unsupported/regex/over-cap, ${cosmetic} cosmetic handled by content scripts)\n`,
  );
  if (skipped > 0 && rules.length >= spec.maxRules) {
    process.stdout.write(
      `  ⚠ hit ${spec.maxRules}-rule cap for ${spec.name}; raise maxRules if you need more coverage.\n`,
    );
  }
}

async function main(): Promise<void> {
  for (const spec of LISTS) {
    try {
      await buildList(spec);
    } catch (err) {
      process.stderr.write(
        `✗ ${spec.name}: ${(err as Error).message} — writing empty ruleset so the build still loads.\n`,
      );
      await writeFile(join(RULES_DIR, `${spec.name}.json`), '[]');
    }
  }
}

void main();
