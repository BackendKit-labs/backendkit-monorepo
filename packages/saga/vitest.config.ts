import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/cli/**'],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 85,
        statements: 85,
      },
      reporter: ['text', 'lcov', 'clover'],
    },
  },
});
