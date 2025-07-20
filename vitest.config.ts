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
  plugins: [
    angular({
      tsconfig: './tsconfig.spec.json',
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
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
    },
    // Add these options for better Zone.js compatibility
    isolate: false,
    pool: 'forks', // Use 'forks' instead of 'threads' for better Zone.js compatibility
  },
});
