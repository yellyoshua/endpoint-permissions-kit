import { resolve } from 'node:path';

export interface TypecheckOutcome {
  readonly exitCode: number;
  readonly output: string;
}

export async function typecheckFixture(fixtureTsconfigPath: string): Promise<TypecheckOutcome> {
  const tscPath = resolve(import.meta.dir, '../../node_modules/typescript/bin/tsc');
  const subprocess = Bun.spawn(['bun', tscPath, '--noEmit', '-p', fixtureTsconfigPath], {
    cwd: resolve(import.meta.dir, '../..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  return { exitCode, output: `${stdout}${stderr}` };
}
