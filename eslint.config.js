import globals from 'globals';
import js from '@eslint/js';
import * as tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Baseline configurations
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,

  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/member-ordering': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/unbound-method': ['warn', { ignoreStatic: true }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      'no-console': ['warn', { allow: ['debug', 'info', 'warn', 'error'] }],
    },
  },

  // Test files
  {
    files: ['**/*.spec.ts', '**/tests/**/*.ts', '**/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },


  // ZZZ page - disable only unsafe assignment warnings
  {
    files: ['**/pages/zzz/**/*.ts'],
    rules: {
      // Disable unsafe assignment and member access warnings for zzz page
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // DFD page - disable specific unsafe any warnings
  {
    files: ['**/pages/dfd/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Angular services and components - relax member ordering
  {
    files: ['**/services/*.ts', '**/components/*.ts', '**/**.component.ts', '**/i18n/*.ts'],
    rules: {
      '@typescript-eslint/member-ordering': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      '.angular/**/*',
      'src/testing/matchers/graph-matchers.d.ts',
      'vitest.config.ts'
    ],
  },
];