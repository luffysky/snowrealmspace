import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * 見 docs/spec/11-engineering-setup.md §6。
 * 「不可關閉」的規則是本專案架構決策的執行機制，不是風格偏好。
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/*.generated.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        React: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',

      // ── ADR-023：禁止直接呼叫 AI 廠商 ──────────────────────
      // ── ADR-002：禁止直接呼叫儲存 SDK ──────────────────────
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@anthropic-ai/sdk',
              message: '請用 @snowrealm/ai-core 的 completeForUsage()（ADR-023）',
            },
            { name: 'openai', message: '請用 @snowrealm/ai-core 的 completeForUsage()（ADR-023）' },
            {
              name: '@google/generative-ai',
              message: '請用 @snowrealm/ai-core 的 completeForUsage()（ADR-023）',
            },
            {
              name: '@aws-sdk/client-s3',
              message: '請用 @snowrealm/storage 的 StorageAdapter（ADR-002）',
            },
          ],
        },
      ],

      // ── 05-theme-tokens.md §7：禁止字面顏色 ────────────────
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: '請使用 --sr-* token，不要寫死顏色（05-theme-tokens.md §7）',
        },
      ],
    },
  },

  // 豁免：這些套件本來就是抽象層的實作者
  {
    files: [
      'packages/storage/**/*.ts',
      'packages/ai-core/**/*.ts',
      'packages/theme-engine/**/*.ts',
      'scripts/**/*.ts',
      'supabase/**/*.ts',
      // 測試用字面顏色是「被拒絕的輸入」，不是樣式
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },

  // CSS 檔案中的顏色是 token 定義本身
  {
    files: ['**/*.config.{js,mjs,ts}', '**/next.config.mjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
)
