import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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
        '/nextcloud-api': {
          target: env.VITE_NEXTCLOUD_URL || 'https://cloud.rreditores.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/nextcloud-api/, ''),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || ''),
      'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(env.VITE_DEEPSEEK_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_DRIVE_CLIENT_ID || ''),
      'import.meta.env.VITE_GOOGLE_DRIVE_API_KEY': JSON.stringify(env.VITE_GOOGLE_DRIVE_API_KEY || ''),
      'import.meta.env.VITE_DRIVE_TEMPLATES_FOLDER_ID': JSON.stringify(env.VITE_DRIVE_TEMPLATES_FOLDER_ID || ''),
      'import.meta.env.VITE_DRIVE_DESTINATION_FOLDER_ID': JSON.stringify(env.VITE_DRIVE_DESTINATION_FOLDER_ID || ''),
      'import.meta.env.VITE_GOOGLE_SHEETS_LOG_ID': JSON.stringify(env.VITE_GOOGLE_SHEETS_LOG_ID || ''),
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            monaco: ['monaco-editor'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
