import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'https://YOUR_BACKEND_URL',
      '/auth': 'https://YOUR_BACKEND_URL',
    },
  },
});
