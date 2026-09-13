import { resolve } from 'node:path';

const E2E_ROOT = resolve(import.meta.dir, '..');
const generateArguments = process.argv.slice(2);

const generation = await Bun.$`bunx pkit generate ${generateArguments}`.cwd(E2E_ROOT).nothrow();
process.exit(generation.exitCode);
