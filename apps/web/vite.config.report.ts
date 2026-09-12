import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Одиночный самодостаточный HTML со страницей отчёта (мок) — для превью.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@profai/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-report',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('report-preview.html', import.meta.url)) },
  },
});
