import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { CATALOG_MARKER, EXIT_CODE } from './protocol';
import { validateStrings } from '../Validators';

interface GenerateOptions {
  cwd: string;
  config?: string;
  out?: string;
}

interface GenerateResult {
  configPath: string;
  outPath: string;
  roles: readonly string[];
}

interface RoleDeclaration extends GenerateResult {
  content: string;
}

interface CheckResult extends GenerateResult {
  isStale: boolean;
}

function resolveConfigPath(workingDirectory: string, config: string | undefined): string {
  if (config !== undefined) return resolve(workingDirectory, config);
  const configFilenames = ['pkit.config.js', 'pkit.config.mjs', 'pkit.config.cjs', 'pkit.config.ts'];
  for (const filename of configFilenames) {
    const candidatePath = resolve(workingDirectory, filename);
    if (existsSync(candidatePath)) return candidatePath;
  }
  throw new Error(`no se encontró ${configFilenames.join(' | ')} en ${workingDirectory}`);
}

async function readRoleCatalog(configPath: string, workingDirectory: string): Promise<readonly string[]> {
  const generatorPath = fileURLToPath(import.meta.url);
  const childPath = resolve(dirname(generatorPath), generatorPath.endsWith('.ts') ? 'child.ts' : 'child.js');
  const childArguments = [childPath, configPath];
  if (extname(configPath) === '.ts' && !process.versions.bun) childArguments.unshift('--experimental-strip-types');
  const { stdout } = await promisify(execFile)(process.execPath, childArguments, { cwd: workingDirectory });
  for (const outputLine of stdout.split('\n')) {
    if (!outputLine.startsWith(CATALOG_MARKER)) continue;
    const catalog: { roles: unknown } = JSON.parse(outputLine.slice(CATALOG_MARKER.length));
    validateStrings(catalog.roles, {
      code: 'INVALID_DEFINITION', message: 'el proceso hijo devolvió un catálogo de roles inválido', minimumLength: 1,
    });
    return catalog.roles;
  }
  throw new Error('el proceso hijo no devolvió el catálogo de roles');
}

function renderRoleDeclarations(roles: readonly string[]): string {
  const declarations = [
    "import 'endpoint-permissions-kit/types';",
    '',
    "declare module 'endpoint-permissions-kit/types' {",
    '  interface RoleRegistry {',
  ];
  for (const role of [...roles].sort()) declarations.push(`    ${JSON.stringify(role)}: true;`);
  declarations.push('  }', '}', '');
  return declarations.join('\n');
}

async function loadRoleDeclaration(options: GenerateOptions): Promise<RoleDeclaration> {
  const { cwd: workingDirectory, config, out } = options;
  const configPath = resolveConfigPath(workingDirectory, config);
  const roles = await readRoleCatalog(configPath, workingDirectory);
  const outPath = out === undefined ? resolve(workingDirectory, 'pkit.generated.d.ts') : resolve(workingDirectory, out);
  return { configPath, outPath, roles, content: renderRoleDeclarations(roles) };
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { content, ...generationResult } = await loadRoleDeclaration(options);
  writeFileSync(generationResult.outPath, content);
  return generationResult;
}

export async function checkGenerated(options: GenerateOptions): Promise<CheckResult> {
  const { content, ...generationResult } = await loadRoleDeclaration(options);
  if (!existsSync(generationResult.outPath)) return { ...generationResult, isStale: true };
  return { ...generationResult, isStale: readFileSync(generationResult.outPath, 'utf8') !== content };
}

export async function main(commandArguments: readonly string[]): Promise<void> {
  try {
    const { positionals, values } = parseArgs({
      args: [...commandArguments],
      allowPositionals: true,
      options: { config: { type: 'string' }, out: { type: 'string' }, check: { type: 'boolean' } },
    });
    if (positionals[0] !== 'generate' || positionals.length !== 1) {
      console.error('uso: pkit generate [--config pkit.config.js] [--out pkit.generated.d.ts] [--check]');
      process.exitCode = EXIT_CODE.usage;
      return;
    }
    const options = { cwd: process.cwd(), config: values.config, out: values.out };
    if (values.check) {
      const checkResult = await checkGenerated(options);
      console.log(checkResult.isStale
        ? `pkit: ${checkResult.outPath} desactualizado, corre pkit generate`
        : `pkit: ${checkResult.outPath} al día`);
      process.exitCode = checkResult.isStale ? EXIT_CODE.failure : EXIT_CODE.success;
      return;
    }
    const generationResult = await generate(options);
    console.log(`pkit: ${generationResult.roles.length} roles escritos en ${generationResult.outPath}`);
    process.exitCode = EXIT_CODE.success;
  } catch (cause) {
    console.error(`pkit: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = EXIT_CODE.failure;
  }
}
