import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import context from '../context';
import protocol from './protocol';

const configPath = process.argv[2];

if (configPath === undefined) {
  console.error('usage: child <pkit.config.js>');
  process.exit(protocol.EXIT_CODE.usage);
}

await import(pathToFileURL(resolve(configPath)).href);

/** The leading newline closes any line the config left open on stdout, so the marker always starts a line of its own. */
process.stdout.write(`\n${protocol.CATALOG_MARKER}${JSON.stringify({ roles: context.get('roles') })}\n`);
