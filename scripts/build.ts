import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('./dist', { recursive: true, force: true });

async function buildBundles(format: 'esm' | 'cjs', entrypoints: string[]): Promise<void> {
  const buildResult = await Bun.build({
    entrypoints,
    root: './src',
    outdir: `./dist/${format}`,
    target: 'node',
    format,
    packages: 'external',
    sourcemap: 'external',
    naming: format === 'cjs' ? '[dir]/[name].cjs' : '[dir]/[name].js',
  });

  if (!buildResult.success) {
    console.error(buildResult.logs);
    process.exit(1);
  }
}

await buildBundles('esm', ['./src/index.ts', './src/types.ts', './src/cli/generate.ts', './src/cli/child.ts']);
await buildBundles('cjs', ['./src/index.ts', './src/types.ts']);
execFileSync('bunx', ['tsc', '--project', 'tsconfig.build.json'], { stdio: 'inherit' });
console.log('dist ready: esm, cjs, types');
