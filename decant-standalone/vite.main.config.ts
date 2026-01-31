import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  build: {
    rollupOptions: {
      // Externalize native modules - they'll be loaded at runtime
      external: [
        'electron',
        'keytar',
        'better-sqlite3',
        're2',
      ],
    },
  },
});
