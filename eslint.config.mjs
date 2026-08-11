import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
  ]),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  nextPlugin.flatConfig.recommended,
  {
    files: ['src/server/chat/narration.ts', 'app/api/**/route.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/src/server/db/**'],
              message:
                'Keep database access behind an owner-scoped service boundary.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/api/chat/route.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(insert|update|delete)$/]',
          message: 'The chat route must remain read-only.',
        },
      ],
    },
  },
])
