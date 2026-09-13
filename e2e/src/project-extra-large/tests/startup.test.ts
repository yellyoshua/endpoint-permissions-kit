import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

interface StartupCase {
  readonly fixture: string;
  readonly code: string;
}

const E2E_ROOT = resolve(import.meta.dir, '../../..');
const FIXTURES_DIR = resolve(import.meta.dir, 'startup');

const CASES: readonly StartupCase[] = [
  { fixture: 'duplicate-registration', code: 'DUPLICATE_REGISTRATION' },
  { fixture: 'role-not-declared', code: 'ROLE_NOT_DECLARED' },
  { fixture: 'sealed', code: 'SEALED' },
  { fixture: 'name-without-actions', code: 'INVALID_DEFINITION' },
  { fixture: 'self-referencing-grant', code: 'INVALID_DEFINITION' },
  { fixture: 'grant-with-wildcard', code: 'INVALID_DEFINITION' },
  { fixture: 'role-hook-without-path', code: 'INVALID_DEFINITION' },
  { fixture: 'context-after-registration', code: 'INVALID_DEFINITION' },
  { fixture: 'not-sealed', code: 'NOT_SEALED' },
  { fixture: 'unknown-role', code: 'UNKNOWN_ROLE' },
  { fixture: 'unknown-action', code: 'UNKNOWN_ACTION' },
  { fixture: 'validation-error', code: 'VALIDATION_ERROR' },
];

interface SpawnOutcome {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function spawnInE2E(command: readonly string[]): Promise<SpawnOutcome> {
  const subprocess = Bun.spawn([...command], { cwd: E2E_ROOT, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  return { exitCode, stdout, stderr };
}

describe('extra-large: broken configurations and runtime failures reported from a child process', () => {
  for (const startupCase of CASES) {
    test(`${startupCase.fixture} → ${startupCase.code}`, async () => {
      const outcome = await spawnInE2E(['bun', resolve(FIXTURES_DIR, `${startupCase.fixture}.ts`)]);
      if (outcome.exitCode !== 0) console.error(outcome.stderr);
      expect(outcome.exitCode).toBe(0);
      expect(JSON.parse(outcome.stdout.trim())).toEqual({ code: startupCase.code });
    });
  }

  test('pkit generate --check exits 0 for the committed role types', async () => {
    const outcome = await spawnInE2E(['bunx', 'pkit', 'generate', '--check']);
    if (outcome.exitCode !== 0) console.error(`${outcome.stdout}${outcome.stderr}`);
    expect(outcome.exitCode).toBe(0);
  });
});
