import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/performance/sales/*.perf.ts'],
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 120000,
  },
});
