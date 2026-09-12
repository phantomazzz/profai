import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // dev: берём shared из исходников, без предварительной сборки dist
      '@profai/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true, // слушать на всех интерфейсах (и 127.0.0.1, и ::1) — чтобы localhost открывался
    port: 5173,
    strictPort: true,
    proxy: {
      // когда появится API-сервер (Фаза 1 backend) — запросы /api пойдут на него
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
