import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
test('el fixture tests/typecheck compila sin errores', compileRoleContracts, 30000);

async function compileRoleContracts() {
  const projectDirectory = resolve(import.meta.dir, '..');
  const compilerPath = resolve(projectDirectory, 'node_modules/typescript/bin/tsc');
  const typecheck = promisify(execFile)(process.execPath, [compilerPath, '-p', resolve(projectDirectory, 'tests/typecheck')], { cwd: projectDirectory });
  await expect(typecheck).resolves.toMatchObject({ stderr: '' });
}
