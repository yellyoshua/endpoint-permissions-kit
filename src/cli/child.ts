import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { context } from '../context';
import { CATALOG_MARKER, EXIT_CODE } from './protocol';

const configPath = process.argv[2];

if (configPath === undefined) {
  console.error('usage: child <pkit.config.js>');
  process.exit(EXIT_CODE.usage);
}

await import(pathToFileURL(resolve(configPath)).href);
process.stdout.write(`\n${CATALOG_MARKER}${JSON.stringify({ roles: context.get('roles') })}\n`);
