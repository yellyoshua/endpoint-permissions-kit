import { resolve } from 'node:path';

const REPOSITORY_ROOT = resolve(import.meta.dir, '../..');

const build = await Bun.$`bun run build`.cwd(REPOSITORY_ROOT).nothrow();
process.exit(build.exitCode);
