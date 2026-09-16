import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import generator from '../src/cli/generate';

const consumerDirectories: string[] = [];

describe('pkit generate', () => {
  afterEach(() => {
    for (const consumerDirectory of consumerDirectories.splice(0)) {
      rmSync(consumerDirectory, { recursive: true, force: true });
    }
  });

  describe('generate', () => {
    test('extends RoleRegistry with quoted, sorted keys', async () => {
      const consumerDirectory = createConsumer(`
      pkit.context.set('roles', ['staff', 'content-manager']);
      `, 'pkit.config.mjs');
      const generationResult = await generator.generate({ cwd: consumerDirectory });

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
    });

    test('evaluates the config in an isolated process and writes pkit.generated.d.ts', async () => {
      const consumerDirectory = createConsumer(`
      console.log('stdout noise that must not break parsing');
      pkit.context.set('roles', ['admin', 'staff']);
      `, 'pkit.config.mjs');
      const generationResult = await generator.generate({ cwd: consumerDirectory });

      expect(generationResult.roles).toEqual(['admin', 'staff']);
      expect(readFileSync(generationResult.outPath, 'utf8')).toContain('"admin": true;');
      expect(await generator.checkGenerated({ cwd: consumerDirectory })).toMatchObject({ isStale: false });
    });

    test('propagates a config failure without overwriting the types', async () => {
      const consumerDirectory = createConsumer("throw new Error('invalid permission configuration');", 'pkit.config.mjs');
      const declarationPath = join(consumerDirectory, 'pkit.generated.d.ts');

      writeFileSync(declarationPath, 'existing declarations');

      await expect(generator.generate({ cwd: consumerDirectory })).rejects.toThrow(/invalid permission configuration/);
      expect(readFileSync(declarationPath, 'utf8')).toBe('existing declarations');
    });
  });

  describe('checkGenerated', () => {
    test('detects a stale file without writing', async () => {
      const consumerDirectory = createConsumer(`
      pkit.context.set('roles', ['admin']);
      `, 'pkit.config.mjs');

      writeFileSync(join(consumerDirectory, 'pkit.generated.d.ts'), 'old');
      const checkResult = await generator.checkGenerated({ cwd: consumerDirectory });

      expect(checkResult.isStale).toBe(true);
      expect(readFileSync(checkResult.outPath, 'utf8')).toBe('old');
    });

    test('reports a missing file and honors explicit config and out', async () => {
      const consumerDirectory = createConsumer('', 'roles.mjs');
      const options = { cwd: consumerDirectory, config: 'roles.mjs', out: 'roles.d.ts' };

      expect(await generator.checkGenerated(options)).toMatchObject({ isStale: true, roles: ['general'] });

      await generator.generate(options);

      expect(await generator.checkGenerated(options)).toMatchObject({ isStale: false, outPath: join(consumerDirectory, 'roles.d.ts') });
    });
  });

  describe('config resolution', () => {
    test('throws with the list of searched names when no config exists', async () => {
      const consumerDirectory = createConsumer('', 'unrelated.js');

      await expect(generator.generate({ cwd: consumerDirectory })).rejects.toThrow(/pkit\.config\.js \| pkit\.config\.mjs/);
    });
  });
});

function createConsumer(config: string, filename: string): string {
  const consumerDirectory = mkdtempSync(join(tmpdir(), 'pkit-'));

  consumerDirectories.push(consumerDirectory);
  const libraryUrl = pathToFileURL(resolve(import.meta.dir, '../src/index.ts')).href;

  writeFileSync(join(consumerDirectory, filename), `import pkit from ${JSON.stringify(libraryUrl)};\n${config}`);

  return consumerDirectory;
}
