import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { phase2ApiPlugin } from './server/api-plugin.mjs';

export default defineConfig({
  plugins: [react(), phase2ApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false
  },
  preview: {
    host: '127.0.0.1'
  }
});
