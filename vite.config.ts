import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/gcg-mulligan-app/',
  plugins: [react()],
  server: {
    proxy: {
      '/gcg-api': {
        target: 'https://www.gundam-gcg.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gcg-api/, ''),
      },
    },
  },
});
