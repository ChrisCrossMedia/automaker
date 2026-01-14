import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const eslintConfig = defineConfig([
  js.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // React
        React: 'readonly',
        JSX: 'readonly',
        // Electron
        Electron: 'readonly',
        // Vite Define
        __APP_VERSION__: 'readonly',
        // TypeScript/Node.js Types
        NodeJS: 'readonly',
        ScrollBehavior: 'readonly',
        // Fetch API Types
        RequestCache: 'readonly',
        RequestInit: 'readonly',
        // TypeScript Types (for @ts-nocheck files)
        AgentModel: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-nocheck': 'allow-with-description' }],
      '@typescript-eslint/no-require-imports': 'warn',
      'no-control-regex': 'off',
    },
  },
  globalIgnores([
    'dist/**',
    'dist-electron/**',
    'node_modules/**',
    'server-bundle/**',
    'release/**',
    'src/routeTree.gen.ts',
  ]),
]);

export default eslintConfig;
