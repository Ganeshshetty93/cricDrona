import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// A separate, loopback-only UI sandbox. These aliases are never used by build or dev.
// No real authentication or database requests are made from this server.
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY']) process.env[name] = '';
const previewFile = name => fileURLToPath(new URL(`../preview/${name}`, import.meta.url));
const server = await createServer({
  plugins: [{
    name: 'cricdrona-local-design-preview', enforce: 'pre',
    resolveId(source) {
      if (/(?:^|\/)context\/AuthContext(?:\.jsx)?$/.test(source)) return previewFile('AuthContext.jsx');
      if (/(?:^|\/)lib\/api(?:\.js)?$/.test(source)) return previewFile('api.js');
      if (/(?:^|\/)lib\/supabase(?:\.js)?$/.test(source)) return previewFile('supabase.js');
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url.startsWith('/api/')) {
          response.statusCode = 403;
          response.end('The design preview does not connect to a database.');
          return;
        }
        next();
      });
    },
  }],
  server: { host: '127.0.0.1', port: 5184, strictPort: true, proxy: {} },
});
await server.listen();
server.printUrls();
console.log('Local design preview: sample data only. Open /admin or /dashboard.');
async function close() { await server.close(); process.exit(0); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
