#!/usr/bin/env node
import { main } from '../dist/esm/cli/generate.js';

await main(process.argv.slice(2));
