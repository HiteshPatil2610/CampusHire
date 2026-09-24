import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

/**
 * `npm run test:integration` — tests that talk to a real Postgres (a Neon test
 * branch, see vitest.integration.setup.ts). Kept out of `npm test` so the unit
 * suite stays fast and needs no database.
 *
 * Standalone rather than `mergeConfig(base, …)`: mergeConfig concatenates
 * arrays, so the base config's `exclude` of tests/integration would win.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    exclude: [...configDefaults.exclude],
    setupFiles: ['./vitest.setup.ts', './vitest.integration.setup.ts'],
    // One shared database: files run one at a time so fixtures never race.
    fileParallelism: false,
    // A suspended Neon compute can take a few seconds to wake.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
