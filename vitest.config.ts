import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// One runner, three layers of the pyramid. Unit and component tests need no
// database; the integration project needs DATABASE_URL pointing at PostgreSQL.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.tsx'],
          setupFiles: ['tests/component/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          // Each file seeds its own schema; bcrypt-heavy seeding needs headroom.
          hookTimeout: 60_000,
          testTimeout: 30_000,
          // Seen once locally: a supertest "socket hang up" under a full parallel
          // coverage run. Retry once in CI only, matching the Playwright config.
          retry: process.env.CI ? 1 : 0,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'src/**/*.{ts,tsx}'],
      exclude: ['server/index.ts', 'server/update-images.ts', 'src/main.tsx', 'src/types.ts'],
      reporter: ['text', 'html', 'json-summary'],
      // Floors sit just under the current figures so coverage can only ratchet up.
      // Raise them as Admin.tsx and App.tsx gain component tests.
      thresholds: {
        statements: 74,
        branches: 67,
        functions: 65,
        lines: 74,
        'server/**': { statements: 94, branches: 92, functions: 88, lines: 94 },
      },
    },
  },
});
