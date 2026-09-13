import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { API_PORT, VITE_PORT } from './src/ports';

export default defineConfig({
  plugins: [react()],
  server: {
    port: VITE_PORT,
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
});
