import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

console.log('🧹 Cleaning dist directory...');
if (existsSync('./dist')) {
  rmSync('./dist', { recursive: true, force: true });
}

console.log('🚀 Building library outputs...');

// 1. ESM build (ECMAScript Modules)
const esmBuild = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist/esm',
  target: 'node',
  format: 'esm',
  sourcemap: 'external',
  packages: 'external',
});

if (!esmBuild.success) {
  console.error('❌ ESM Build failed:', esmBuild.logs);
  process.exit(1);
}
console.log('✅ ESM build completed (dist/esm)');

// 2. CommonJS build (CJS / require)
const cjsBuild = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist/cjs',
  target: 'node',
  format: 'cjs',
  sourcemap: 'external',
  packages: 'external',
});

if (!cjsBuild.success) {
  console.error('❌ CommonJS Build failed:', cjsBuild.logs);
  process.exit(1);
}
console.log('✅ CommonJS build completed (dist/cjs)');

// 3. Browser / IIFE bundle (ECMA / Universal browser bundle)
const iifeBuild = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist/iife',
  target: 'browser',
  format: 'iife',
  sourcemap: 'external',
});

if (!iifeBuild.success) {
  console.error('❌ IIFE Build failed:', iifeBuild.logs);
  process.exit(1);
}
console.log('✅ IIFE/Browser bundle completed (dist/iife)');

// 4. Type Declarations (.d.ts)
console.log('📘 Generating TypeScript declarations...');
try {
  execSync('bunx tsc --project tsconfig.build.json', { stdio: 'inherit' });
  console.log('✅ TypeScript declarations generated (dist/types)');
} catch (error) {
  console.error('❌ Type declaration generation failed');
  process.exit(1);
}

console.log('🎉 Library build completed successfully!');
