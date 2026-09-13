import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Method } from 'endpoint-permissions-kit';
import { visibleScreens } from '../../client/screens';
import SCREENS from '../client/screens';
import type { MeResponse } from '../../server/meRoute';
import { httpRequest } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';

interface ExpectedScreens {
  readonly user: string | undefined;
  readonly screens: Readonly<Record<string, readonly Method[]>>;
}

const EXPECTED: readonly ExpectedScreens[] = [
  { user: undefined, screens: { published: ['find'] } },
  { user: 'mia', screens: { notes: ['find', 'create', 'update'], tags: ['find'], profile: ['find', 'update'] } },
  { user: 'eli', screens: { notes: ['find', 'create', 'update', 'remove'], tags: ['find', 'create', 'remove'], profile: ['find', 'update'] } },
  { user: 'noah', screens: { notes: ['find', 'create', 'update'] } },
];

let server: RunningServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('small: /me access map ↔ screens', () => {
  for (const expected of EXPECTED) {
    test(`${expected.user ?? 'anonymous'} sees ${Object.keys(expected.screens).join(', ') || 'nothing'}`, async () => {
      const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/small/me', userId: expected.user });
      const visible = visibleScreens(SCREENS, me.body.role, me.body.access);
      const actual = Object.fromEntries(visible.map(({ screen, methods }) => [screen.path, methods]));
      expect(actual).toEqual(expected.screens);
    });
  }

  test('every screen declares a permission of the small prefix', () => {
    for (const screen of SCREENS) expect(screen.permission.action.startsWith('small.')).toBe(true);
  });
});
