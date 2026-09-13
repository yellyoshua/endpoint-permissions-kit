import { resolve } from 'node:path';

const E2E_ROOT = resolve(import.meta.dir, '..');
const REPOSITORY_ROOT = resolve(E2E_ROOT, '..');

interface Step {
  readonly title: string;
  readonly command: string[];
  readonly cwd: string;
}

const STEPS: readonly Step[] = [
  { title: 'build library', command: ['bun', 'run', 'build'], cwd: REPOSITORY_ROOT },
  { title: 'check generated role types', command: ['bunx', 'pkit', 'generate', '--check'], cwd: E2E_ROOT },
  { title: 'typecheck', command: ['bunx', 'tsc', '--noEmit'], cwd: E2E_ROOT },
  { title: 'bun test', command: ['bun', 'test'], cwd: E2E_ROOT },
];

for (const step of STEPS) {
  console.log(`\n== ${step.title}: ${step.command.join(' ')}`);
  const subprocess = Bun.spawn(step.command, { cwd: step.cwd, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await subprocess.exited;
  if (exitCode !== 0) {
    console.error(`step failed: ${step.title} (exit ${exitCode})`);
    process.exit(exitCode);
  }
}
