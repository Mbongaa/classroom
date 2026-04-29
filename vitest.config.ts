import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Mirrors the `@/*` alias in tsconfig.json so route handler tests that
// import from `@/lib/...` resolve under vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
