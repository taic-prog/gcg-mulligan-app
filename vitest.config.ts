import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
      include: ['src/logic/**/*.ts', 'src/store/deckStore.ts'],
      // cardCache・imageOcr は IndexedDB/Tesseract.js（ブラウザ外部API）に直接依存するため除外
      exclude: ['src/logic/cardCache.ts', 'src/logic/imageOcr.ts'],
    },
  },
});
