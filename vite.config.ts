import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Priorizar variables de sistema (Docker/CI) sobre archivos .env
  const previewApiUrl = process.env.VITE_PREVIEW_API_URL || env.VITE_PREVIEW_API_URL || '';

  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api-preview': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-preview/, ''),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'import.meta.env.VITE_PREVIEW_API_URL': JSON.stringify(previewApiUrl),
      'import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_DRIVE_CLIENT_ID || process.env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''),
      'import.meta.env.VITE_GOOGLE_DRIVE_API_KEY': JSON.stringify(env.VITE_GOOGLE_DRIVE_API_KEY || process.env.VITE_GOOGLE_DRIVE_API_KEY || ''),
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
