/**
 * 分層規則。見 docs/spec/11-engineering-setup.md §1。
 *
 * 這些規則存在的理由是「架構會腐化，而且腐化時沒有人會注意到」。
 * 一次 `packages/ui` import 了 `@snowrealm/db`，之後就再也拆不開了。
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: '循環相依會讓模組初始化順序變得不可預測。',
      from: {},
      to: { circular: true },
    },

    {
      name: 'packages-must-not-import-apps',
      severity: 'error',
      comment:
        'packages/* 是可重用的函式庫，不得依賴任何 app。' +
        '一旦反向依賴，套件就綁死在某個 app 的結構上。',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },

    {
      name: 'ui-must-stay-pure',
      severity: 'error',
      comment:
        'packages/ui 只做展示，不得依賴任何其他 workspace 套件。' +
        '它一旦知道資料庫或 AI 的存在，就無法在 Storybook 或設計稿中獨立使用。',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(?!ui/)' },
    },

    {
      name: 'features-must-not-cross-import',
      severity: 'error',
      comment:
        'apps/web/features/* 之間不得互相 import。' +
        '共用邏輯要上提到 packages/，否則功能邊界會在幾週內消失。',
      from: { path: '^apps/web/features/([^/]+)/' },
      to: {
        path: '^apps/web/features/([^/]+)/',
        pathNot: '^apps/web/features/$1/',
      },
    },

    {
      name: 'no-ai-vendor-sdk-outside-ai-core',
      severity: 'error',
      comment:
        'ADR-023：AI 廠商 SDK 只能出現在 packages/ai-core。' +
        '其他地方一律走 completeForUsage()。',
      from: { pathNot: '^packages/ai-core/' },
      to: { path: 'node_modules/(@anthropic-ai|openai|@google/generative-ai)' },
    },

    {
      name: 'no-s3-sdk-outside-storage',
      severity: 'error',
      comment: 'ADR-002：S3 SDK 只能出現在 packages/storage。其他地方走 StorageAdapter。',
      from: { pathNot: '^packages/storage/' },
      to: { path: 'node_modules/@aws-sdk/' },
    },

    {
      name: 'no-orphans',
      severity: 'warn',
      comment: '沒有任何人引用的模組通常是刪漏的殘留。',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '(^|/)(eslint|vitest|playwright|next)\\.config\\.(js|cjs|mjs|ts)$',
          '^apps/web/(middleware|next-env)\\.',
          '^apps/web/app/',
          '^scripts/',
          '^supabase/',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['node_modules', '\\.next', 'dist', '\\.turbo', '\\.test\\.tsx?$', 'coverage'],
    },
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
