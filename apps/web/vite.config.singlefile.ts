import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// Отдельная сборка в один самодостаточный HTML (для превью/шаринга).
// Не влияет на обычный `npm run build`.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@profai/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
  },
});
