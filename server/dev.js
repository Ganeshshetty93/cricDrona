import { loadProjectEnvironment, startApi, closeApi } from './runtime.js';

try {
  loadProjectEnvironment();
  const { server } = await startApi();
  console.log('This command serves the API. For the website, run npm start.');
  if (server) {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await closeApi(server);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  console.error(`Could not start CricDrona API: ${error.message}`);
  process.exitCode = 1;
}
