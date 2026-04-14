import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      /** `errors.ts` is type-only; excluded so thresholds apply to executable modules. */
      exclude: ['src/errors.ts'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100
      }
    }
  }
});
