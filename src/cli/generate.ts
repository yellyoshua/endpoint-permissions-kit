import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import protocol from './protocol';

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

interface GenerateRequest {
  options: GenerateOptions;
  isCheck: boolean;
}

const generator = {
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const { content, ...generationResult } = await loadRoleDeclaration(options);

    writeFileSync(generationResult.outPath, content);

    return generationResult;
  },

  async checkGenerated(options: GenerateOptions): Promise<CheckResult> {
    const { content, ...generationResult } = await loadRoleDeclaration(options);
    const isStale = !existsSync(generationResult.outPath) || readFileSync(generationResult.outPath, 'utf8') !== content;

    return { ...generationResult, isStale };
  },

  async main(commandArguments: readonly string[]): Promise<void> {
    const request = readRequest(commandArguments);

    if (request === null) {
      console.error('usage: pkit generate [--config pkit.config.js] [--out pkit.generated.d.ts] [--check]');
      process.exitCode = protocol.EXIT_CODE.usage;

      return;
    }

    try {
      const { options } = request;

      if (request.isCheck) {
        const checkResult = await generator.checkGenerated(options);

        console.log(checkResult.isStale
          ? `pkit: ${checkResult.outPath} is stale, run pkit generate`
          : `pkit: ${checkResult.outPath} is up to date`);

        process.exitCode = checkResult.isStale ? protocol.EXIT_CODE.failure : protocol.EXIT_CODE.success;

        return;
      }

      const generationResult = await generator.generate(options);

      console.log(`pkit: ${generationResult.roles.length} roles written to ${generationResult.outPath}`);

      process.exitCode = protocol.EXIT_CODE.success;
    } catch (cause) {
      console.error(`pkit: ${cause instanceof Error ? cause.message : String(cause)}`);

      process.exitCode = protocol.EXIT_CODE.failure;
    }
  },
};

/**
 * Reads the command line, or `null` for anything the CLI cannot act on.
 * `parseArgs` throws on an unknown option or a missing value; that is an invalid
 * command line, not a runtime failure, so it exits with the usage code.
 */
function readRequest(commandArguments: readonly string[]): GenerateRequest | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...commandArguments],
      allowPositionals: true,
      options: { config: { type: 'string' }, out: { type: 'string' }, check: { type: 'boolean' } },
    });

    if (positionals[0] !== 'generate' || positionals.length !== 1) return null;

    return { options: { cwd: process.cwd(), config: values.config, out: values.out }, isCheck: values.check === true };
  } catch {
    return null;
  }
}

async function loadRoleDeclaration(options: GenerateOptions): Promise<RoleDeclaration> {
  const configPath = resolveConfigPath(options.cwd, options.config);
  const roles = await readRoleCatalog(configPath, options.cwd);
  const outPath = resolve(options.cwd, options.out === undefined ? 'pkit.generated.d.ts' : options.out);

  return { configPath, outPath, roles, content: renderRoleDeclarations(roles) };
}

function resolveConfigPath(workingDirectory: string, config: string | undefined): string {
  if (config !== undefined) return resolve(workingDirectory, config);

  const configFilenames = ['pkit.config.js', 'pkit.config.mjs', 'pkit.config.cjs', 'pkit.config.ts'];

  for (const filename of configFilenames) {
    const candidatePath = resolve(workingDirectory, filename);

    if (existsSync(candidatePath)) return candidatePath;
  }

  throw new Error(`${configFilenames.join(' | ')} not found in ${workingDirectory}`);
}

async function readRoleCatalog(configPath: string, workingDirectory: string): Promise<readonly string[]> {
  const generatorPath = fileURLToPath(import.meta.url);

  /** The child is always this file's sibling: `.ts` while running from `src/`, `.js` once built into `dist/`. */
  const childPath = resolve(dirname(generatorPath), generatorPath.endsWith('.ts') ? 'child.ts' : 'child.js');
  const childArguments = [childPath, configPath];

  if (extname(configPath) === '.ts' && !process.versions.bun) childArguments.unshift('--experimental-strip-types');

  const { stdout } = await promisify(execFile)(process.execPath, childArguments, {
    cwd: workingDirectory,
    timeout: protocol.CHILD_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: protocol.CHILD_MAX_BUFFER_BYTES,
  });

  for (const outputLine of stdout.split('\n')) {
    if (outputLine.startsWith(protocol.CATALOG_MARKER)) return parseRoleCatalog(outputLine.slice(protocol.CATALOG_MARKER.length));
  }

  throw new Error('child process did not return the role catalog');
}

/** The child prints arbitrary text, so a broken payload fails with a CLI message instead of a raw JSON.parse error. */
function parseRoleCatalog(payload: string): readonly string[] {
  let catalog: unknown = null;

  try {
    catalog = JSON.parse(payload);
  } catch {
    throw new Error('child process returned a malformed role catalog');
  }

  const roles: unknown = catalog !== null && typeof catalog === 'object' ? (catalog as { roles: unknown }).roles : undefined;

  if (!Array.isArray(roles)) throw new Error('child process returned an invalid role catalog');

  for (const role of roles) {
    if (typeof role !== 'string' || role.length === 0) throw new Error('child process returned an invalid role catalog');
  }

  return roles as readonly string[];
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

export default generator;
