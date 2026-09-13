import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { typecheckFixture } from '../../testing/typecheckFixture';

test('medium: types.fixture.ts compiles with every @ts-expect-error satisfied', async () => {
  const outcome = await typecheckFixture(resolve(import.meta.dir, 'tsconfig.json'));
  if (outcome.exitCode !== 0) console.error(outcome.output);
  expect(outcome.exitCode).toBe(0);
});
