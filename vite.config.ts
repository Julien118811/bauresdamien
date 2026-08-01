import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // Keep chunks reasonable; the PDF/charts libs are the heavy ones.
    chunkSizeWarningLimit: 1200,
  },
});
