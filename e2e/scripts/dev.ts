import { resolve } from 'node:path';

const E2E_ROOT = resolve(import.meta.dir, '..');

const api = Bun.spawn(['bun', 'run', 'src/server/index.ts'], { cwd: E2E_ROOT, stdout: 'inherit', stderr: 'inherit' });
const vite = Bun.spawn(['bunx', 'vite'], { cwd: E2E_ROOT, stdout: 'inherit', stderr: 'inherit' });

function stopBoth(): void {
  api.kill();
  vite.kill();
}

process.on('SIGINT', stopBoth);
process.on('SIGTERM', stopBoth);

const [apiExit, viteExit] = await Promise.all([api.exited, vite.exited]);
process.exit(apiExit === 0 && viteExit === 0 ? 0 : 1);
