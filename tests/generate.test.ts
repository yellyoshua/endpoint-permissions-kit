import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGenerated, generate } from '../src/cli/generate';
const consumerDirectories: string[] = [];

function createConsumer(config: string, filename: string): string {
  const consumerDirectory = mkdtempSync(join(tmpdir(), 'pkit-'));
  consumerDirectories.push(consumerDirectory);
  const libraryUrl = pathToFileURL(resolve(import.meta.dir, '../src/index.ts')).href;
  writeFileSync(join(consumerDirectory, filename), `import pkit from ${JSON.stringify(libraryUrl)};\n${config}`);
  return consumerDirectory;
}
afterEach(removeConsumers);
test('generate amplía RoleRegistry con claves entrecomilladas y ordenadas', renderSortedRoles);
test('generate evalúa el config en un proceso aislado y escribe pkit.generated.d.ts', generateInChildProcess);
test('checkGenerated detecta archivo desactualizado sin escribir', detectStaleDeclaration);
test('sin config lanza con la lista de nombres buscados', rejectMissingConfig);
test('un fallo del config se propaga sin sobrescribir los tipos', preserveDeclarationsOnFailure);
test('checkGenerated informa un archivo ausente y respeta config y out explícitos', checkMissingDeclaration);

function removeConsumers() {
  for (const consumerDirectory of consumerDirectories.splice(0)) {
    rmSync(consumerDirectory, { recursive: true, force: true });
  }
}

async function renderSortedRoles() {
  const consumerDirectory = createConsumer(`
  pkit.context.set('roles', ['staff', 'content-manager']);
  `, 'pkit.config.mjs');
  const generationResult = await generate({ cwd: consumerDirectory });
  expect(readFileSync(generationResult.outPath, 'utf8')).toBe([
    "import 'endpoint-permissions-kit/types';",
    '',
    "declare module 'endpoint-permissions-kit/types' {",
    '  interface RoleRegistry {',
    '    "content-manager": true;',
    '    "staff": true;',
    '  }',
    '}',
    '',
  ].join('\n'));
}

async function generateInChildProcess() {
  const consumerDirectory = createConsumer(`
  console.log('ruido en stdout que no debe romper el parseo');
  pkit.context.set('roles', ['admin', 'staff']);
  `, 'pkit.config.mjs');
  const generationResult = await generate({ cwd: consumerDirectory });
  expect(generationResult.roles).toEqual(['admin', 'staff']);
  expect(readFileSync(generationResult.outPath, 'utf8')).toContain('"admin": true;');
  expect(await checkGenerated({ cwd: consumerDirectory })).toMatchObject({ isStale: false });
}

async function detectStaleDeclaration() {
  const consumerDirectory = createConsumer(`
  pkit.context.set('roles', ['admin']);
  `, 'pkit.config.mjs');
  writeFileSync(join(consumerDirectory, 'pkit.generated.d.ts'), 'viejo');
  const checkResult = await checkGenerated({ cwd: consumerDirectory });
  expect(checkResult.isStale).toBe(true);
  expect(readFileSync(checkResult.outPath, 'utf8')).toBe('viejo');
}

async function rejectMissingConfig() {
  const consumerDirectory = createConsumer('', 'unrelated.js');
  await expect(generate({ cwd: consumerDirectory })).rejects.toThrow(/pkit\.config\.js \| pkit\.config\.mjs/);
}

async function preserveDeclarationsOnFailure() {
  const consumerDirectory = createConsumer("throw new Error('invalid permission configuration');", 'pkit.config.mjs');
  const declarationPath = join(consumerDirectory, 'pkit.generated.d.ts');
  writeFileSync(declarationPath, 'existing declarations');
  await expect(generate({ cwd: consumerDirectory })).rejects.toThrow(/invalid permission configuration/);
  expect(readFileSync(declarationPath, 'utf8')).toBe('existing declarations');
}

async function checkMissingDeclaration() {
  const consumerDirectory = createConsumer('', 'roles.mjs');
  const options = { cwd: consumerDirectory, config: 'roles.mjs', out: 'roles.d.ts' };
  expect(await checkGenerated(options)).toMatchObject({ isStale: true, roles: ['general'] });
  await generate(options);
  expect(await checkGenerated(options)).toMatchObject({ isStale: false, outPath: join(consumerDirectory, 'roles.d.ts') });
}
