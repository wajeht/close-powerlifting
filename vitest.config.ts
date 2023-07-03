import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20000,
    coverage: {
      provider: 'c8',
    },
    setupFiles: ['./test-setup.ts'],
    globals: true,
  },
});
