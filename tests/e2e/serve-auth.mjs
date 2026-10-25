import { createServer } from 'vite';
Object.assign(process.env,{SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_ANON_KEY:'',VITE_SUPABASE_URL:'https://auth-fixture.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only_no_real_project_key',VITE_SUPABASE_ANON_KEY:''});
const server=await createServer({cacheDir:'node_modules/.vite-auth-test',server:{host:'127.0.0.1',port:5185,strictPort:true}});
await server.listen();server.printUrls();
async function close(){await server.close();process.exit(0);}
process.once('SIGINT',close);process.once('SIGTERM',close);
