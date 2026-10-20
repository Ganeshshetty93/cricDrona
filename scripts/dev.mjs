import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const processes = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/dev.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; processes.forEach(p => p.kill()); setTimeout(() => process.exit(code), 200); }
processes.forEach(p => { p.on('error', e => { console.error(e.message); stop(1); }); p.on('exit', code => stop(code ?? 0)); });
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
