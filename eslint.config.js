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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Test files
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '.angular/**/*'],
  },
];