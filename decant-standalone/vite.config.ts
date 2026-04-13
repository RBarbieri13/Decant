import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';
import path from 'path';
import zlib from 'node:zlib';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    react(),
    // Pre-compress static assets at build time (gzip)
    compression({
      algorithm: 'gzip',
      exclude: [/\.(br|gz)$/],
    }),
    // Pre-compress static assets at build time (brotli)
    compression({
      algorithm: 'brotliCompress',
      exclude: [/\.(br|gz)$/],
      compressionOptions: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        },
      },
    }),
  ],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false, // Keep original origin for CORS
        secure: false,
        ws: true, // Support WebSocket/SSE
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['@tabler/icons-react'],
        },
      },
    },
  },
});
