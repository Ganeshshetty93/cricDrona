import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
// Separate local UI sandbox; production and normal dev never use these replacements.
for (const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_ANON_KEY']) process.env[name] = '';
const file = name => fileURLToPath(new URL(`../preview/${name}`, import.meta.url));
const server = await createServer({
  cacheDir: 'node_modules/.vite-preview',
  plugins: [{ name: 'isolated-design-preview', enforce: 'pre',
    resolveId(source) {
      if (/(?:^|\/)context\/AuthContext(?:\.jsx)?$/.test(source)) return file('AuthContext.jsx');
      if (/(?:^|\/)lib\/api(?:\.js)?$/.test(source)) return file('api.js');
      if (/(?:^|\/)lib\/supabase(?:\.js)?$/.test(source)) return file('supabase.js');
    },
    configureServer(server) { server.middlewares.use((req,res,next) => { if (req.url.startsWith('/api/')) { res.statusCode=403; res.end('Design preview: no database connection.'); } else next(); }); },
  }],
  server: { host: '127.0.0.1', port: Number(process.env.DESIGN_PORT || 5184), strictPort: true, proxy: {} },
});
await server.listen(); server.printUrls();
console.log('Sample data only. Open /admin or /dashboard. Changes reset on reload.');
async function close() { await server.close(); process.exit(0); }
process.once('SIGINT',close); process.once('SIGTERM',close);
