// vitest.config.ts
// Unit tests for pure logic (routing, settlement, schemas). No React Native rendering here.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.expo/**'],
    environment: 'node',
  },
});
