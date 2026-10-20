import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Node 22+ loads local environment files without another dependency.
for (const file of ['.env', '.env.local']) {
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
}
const { default: handler } = await import('./handler.js');
const port = Number(process.env.API_PORT || 3001);
createServer(handler).listen(port, '127.0.0.1', () => console.log(`CricDrona API listening on http://127.0.0.1:${port}`));
