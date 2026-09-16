#!/usr/bin/env node
import generator from '../dist/esm/cli/generate.js';

await generator.main(process.argv.slice(2));
