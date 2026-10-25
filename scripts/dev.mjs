import { projectRoot, devHeader, devIdentity, loadProjectEnvironment, environmentPort, startApi, closeApi, isCricDronaClient, websiteUrl, portConflict } from '../server/runtime.js';

let api;
let client;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  await Promise.all([client?.close(), closeApi(api?.server)]);
}

try {
  loadProjectEnvironment();
  const apiPort = environmentPort('API_PORT', 4001);
  const clientPort = environmentPort('CLIENT_PORT', 5173);
  if (apiPort === clientPort) throw new Error('API_PORT and CLIENT_PORT must use different ports.');
  api = await startApi({ port: apiPort });
  const url = `http://127.0.0.1:${clientPort}`;
  // Reusing a client requires no new watcher, dependency optimizer or child process.
  if (await isCricDronaClient(url)) {
    console.log(`CricDrona website already running at ${url}; reusing it. Restart that process to apply frontend configuration changes.`);
  } else {
    const { createServer } = await import('vite');
    client = await createServer({
      root: projectRoot,
      clearScreen: false,
      server: { host: '127.0.0.1', port: clientPort, strictPort: true, headers: { [devHeader]: devIdentity('client') } },
    });
    try {
      await client.listen();
      console.log(`CricDrona website listening on ${url}`);
    } catch (error) {
      await client.close();
      client = null;
      // Another invocation may have completed its startup after our initial probe.
      if (await isCricDronaClient(url)) console.log(`CricDrona website already running at ${url}; reusing it.`);
      else if (error.code === 'EADDRINUSE' || /already in use/i.test(error.message)) throw portConflict('website', clientPort, 'CLIENT_PORT');
      else throw error;
    }
  }
  let ready = false;
  for (let attempt = 0; attempt < 4 && !ready; attempt += 1) {
    ready = await isCricDronaClient(url);
    if (!ready) await new Promise(resolve => setTimeout(resolve, 300));
  }
  if (!ready) throw new Error(`The website is listening at ${url}, but its frontend or API proxy is not ready. Check the errors above and restart the terminal running the website.`);
  console.log(`\nCricDrona is ready.\nOpen the website in your browser: ${await websiteUrl(clientPort)}\nDirect IPv4 address: ${url}\nAPI health: ${api.url}/api/health`);
  if (!client && !api.server) {
    console.log('Both services are already running in another terminal. This command can finish; the website stays available.');
  } else {
    console.log('Keep this terminal open while using the website. Press Ctrl+C to stop the services started here.');
  }
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
} catch (error) {
  console.error(`Could not start CricDrona: ${error.message}`);
  await stop(1);
}
