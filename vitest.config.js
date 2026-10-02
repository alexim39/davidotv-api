import { defineConfig } from 'vitest/config';

// TEST-01: DB-free unit/contract harness. Tests importing live DB connections
// or network clients are excluded until mongodb-memory-server lands (Phase-2).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    testTimeout: 10000,
    // Each file gets a fresh module registry so env-var mutations don't leak.
    isolate: true,
  },
});
