import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const proxy = { '/api': `http://127.0.0.1:${Number(env.API_PORT || 4001)}` };
  return { plugins: [react()], optimizeDeps: { entries: ['index.html'] }, server: { host: '127.0.0.1', port: Number(env.CLIENT_PORT || 5173), strictPort: true, proxy }, preview: { port: 4173, proxy } };
});
