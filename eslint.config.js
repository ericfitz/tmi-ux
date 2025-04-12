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
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // mxGraph external library integration
  {
    files: ['**/diagram-renderer.service.ts', '**/diagram.service.ts'],
    rules: {
      // Disable 'any' type warnings for mxGraph integration
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Disable member ordering warnings
      '@typescript-eslint/member-ordering': 'off',
    },
  },

  // Diagram Editor page and related components/services
  {
    files: ['**/pages/diagram-editor/**/*.ts'],
    rules: {
      // Disable 'any' type warnings for diagram editor
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Disable member ordering warnings
      '@typescript-eslint/member-ordering': 'off',
      // Disable unused variables warnings
      '@typescript-eslint/no-unused-vars': 'off',
      // Disable missing return type warnings
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Disable promise rejection errors
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      // Disable 'this' aliasing errors
      '@typescript-eslint/no-this-alias': 'off',
      // Disable 'arguments' usage errors
      'prefer-rest-params': 'off',
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
    ignores: ['dist/**/*', 'node_modules/**/*', '.angular/**/*'],
  },
];