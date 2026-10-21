import { createServer } from 'vite';
import { apiPort, demoEnvironment, webPort } from './demo-environment.js';

Object.assign(process.env, demoEnvironment);

// Load the application's Vite config/plugins, changing only the test server ports.
const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
});
await server.listen();
server.printUrls();

async function close() {
  await server.close();
  process.exit(0);
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
