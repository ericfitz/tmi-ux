import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@app': resolve(__dirname, './src/app'),
      '@assets': resolve(__dirname, './src/assets'),
      '@environments': resolve(__dirname, './src/environments'),
      '@testing': resolve(__dirname, './src/testing'),
    },
  },
  optimizeDeps: {
    // Don't pre-bundle these to ensure JIT compiler is available
    exclude: ['@angular/compiler'],
    include: ['@angular/common', '@angular/core', '@angular/platform-browser-dynamic'],
  },
  plugins: [
    angular({
      tsconfig: './tsconfig.spec.json',
      jit: true, // Enable JIT compilation mode
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: [
      // Integration tests have transitive Angular Material dependencies that
      // can't compile in vitest/JSDOM. Keep excluded until migrated to Playwright.
      'src/app/pages/dfd/integration/**',
    ],
    setupFiles: ['src/test-setup.ts'],
    server: {
      deps: {
        inline: [/^@angular/, /^@jsverse/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/environments/**',
        'unused/**',
      ],
      // Global coverage floor. Set just below the measured baseline
      // (stmt 73.8% / branch 64.8% / func 71.7% / line 74.6% as of 2026-05)
      // so `pnpm run test:coverage` fails on a regression but tolerates
      // minor run-to-run variance. Raise these as coverage improves.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 68,
        lines: 70,
      },
    },
    // Use 'forks' pool for Zone.js compatibility
    isolate: true,
    pool: 'forks',
    restoreMocks: true,
    clearMocks: true,
  },
});
