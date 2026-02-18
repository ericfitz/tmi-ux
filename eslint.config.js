import globals from 'globals';
import js from '@eslint/js';
import * as tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unusedImports from 'eslint-plugin-unused-imports';

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
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'complexity': ['warn', 20],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off', // We use @typescript-eslint/no-unused-vars
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-unused-imports': 'off', // We use @typescript-eslint/no-unused-vars instead
      '@typescript-eslint/unbound-method': ['warn', { ignoreStatic: true }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      'no-console': ['warn', { allow: ['debug', 'info', 'warn', 'error'] }],
      
      // Architecture validation rules
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['*.module'],
            message: 'NgModules are deprecated. Use standalone components instead.'
          }
        ],
        paths: [
          {
            name: '@angular/material',
            message: 'Import specific Material modules, not the entire library.'
          }
        ]
      }],
    },
  },

  // Architecture validation for core services
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../../pages/*', '../../auth/services/*', '../../auth/components/*', '../pages/*', '../auth/*'],
            message: 'Core services cannot import from feature modules. Use interfaces in core/interfaces instead.'
          }
        ]
      }],
    },
  },

  // Architecture validation for domain layer
  {
    files: ['src/app/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@angular/core',
            message: 'Domain layer should be pure business logic without Angular dependencies.'
          },
          {
            name: '@angular/common',
            message: 'Domain layer should be pure business logic without Angular dependencies.'
          },
          {
            name: '@angular/material',
            message: 'Domain layer should be pure business logic without Angular Material dependencies.'
          },
          {
            name: '@angular/material/*',
            message: 'Domain layer should be pure business logic without Angular Material dependencies.'
          },
          {
            name: 'rxjs',
            message: 'Domain layer should be pure business logic without RxJS dependencies.'
          },
          {
            name: 'rxjs/*',
            message: 'Domain layer should be pure business logic without RxJS dependencies.'
          }
        ],
        patterns: [
          {
            group: ['../services/*', '../infrastructure/*', '../../infrastructure/*', '../application/*', '../../application/*'],
            message: 'Domain layer should not depend on infrastructure, application, or service layers.'
          },
          {
            group: ['@antv/*'],
            message: 'Domain layer should not depend on X6 or other UI framework libraries.'
          },
          {
            group: ['@jsverse/*'],
            message: 'Domain layer should not depend on third-party framework libraries.'
          }
        ]
      }],
    },
  },

  // Files exempt from certain import restrictions
  {
    files: ['src/app/shared/imports.ts', 'src/app/app.config.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@angular/material',
            message: 'Import specific Material modules, not the entire library.'
          }
        ]
        // Allow module imports in app.config.ts for third-party modules
      }],
    },
  },

  // E2E test files (Playwright)
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.e2e.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'no-console': 'off',
    },
  },

  // Unit test files (Vitest)
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