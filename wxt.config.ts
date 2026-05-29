import { defineConfig } from 'wxt';

// WXT generates the MV3 manifest from this config + entrypoints in src/.
// DNR static rulesets are produced by scripts/build-rules.ts (pnpm run rules)
// into src/rules/ before build.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'full-blocker',
    description: 'Block ads, banners and trackers everywhere — including YouTube.',
    version: '0.1.0',
    permissions: [
      'declarativeNetRequest',
      'declarativeNetRequestFeedback',
      'storage',
      'tabs',
      'activeTab',
    ],
    host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'curated',
          enabled: true,
          path: 'rules/curated.json',
        },
        {
          id: 'easylist',
          enabled: true,
          path: 'rules/easylist.json',
        },
        {
          id: 'easyprivacy',
          enabled: true,
          path: 'rules/easyprivacy.json',
        },
      ],
    },
    action: {
      default_title: 'full-blocker',
      default_popup: 'popup/index.html',
    },
  },
});
