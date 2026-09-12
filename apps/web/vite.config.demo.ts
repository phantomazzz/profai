import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Один самодостаточный HTML с демо-отчётом (мок) — открывается двойным кликом,
// без сервера и без прохождения теста. Не влияет на обычный `npm run build`.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@profai/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('demo.html', import.meta.url)) },
  },
});
