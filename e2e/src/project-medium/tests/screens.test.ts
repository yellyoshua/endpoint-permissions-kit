import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Method } from 'endpoint-permissions-kit';
import { visibleScreens } from '../../client/screens';
import SCREENS from '../client/screens';
import type { MeResponse } from '../../server/meRoute';
import { httpRequest } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';

interface ExpectedScreens {
  readonly user: string;
  readonly screens: Readonly<Record<string, readonly Method[]>>;
}

const EXPECTED: readonly ExpectedScreens[] = [
  { user: 'ava', screens: { dashboard: ['find'], portals: ['find'], 'portals-editable': ['find'] } },
  { user: 'ben', screens: { dashboard: ['find'], portals: ['find', 'remove'], 'portals-editable': ['find'], assets: ['find', 'create', 'update', 'remove'] } },
  { user: 'sam', screens: { dashboard: ['find'], portals: ['find'], 'portals-editable': ['find'] } },
  { user: 'cleo', screens: { dashboard: ['find'], portals: ['find'], 'portals-editable': ['find'] } },
  { user: 'dev', screens: { 'portals-editable': ['find', 'update'] } },
  { user: 'eve', screens: { portals: ['find'] } },
  { user: 'nil', screens: {} },
  { user: 'ana', screens: { dashboard: ['find'], assets: ['find'] } },
  { user: 'ian', screens: { 'assets-editable': ['find', 'update'] } },
];

let server: RunningServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('medium: /me access map ↔ screens', () => {
  for (const expected of EXPECTED) {
    test(`${expected.user} sees ${Object.keys(expected.screens).join(', ') || 'nothing'}`, async () => {
      const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/medium/me', userId: expected.user });
      const visible = visibleScreens(SCREENS, me.body.role, me.body.access);
      const actual = Object.fromEntries(visible.map(({ screen, methods }) => [screen.path, methods]));
      expect(actual).toEqual(expected.screens);
    });
  }

  test('corrupt identities get no screens because /me itself is denied', async () => {
    for (const user of ['mal', 'old']) {
      const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/medium/me', userId: user });
      expect(me.status).toBe(403);
    }
  });

  test('every screen declares a permission of the medium prefix', () => {
    for (const screen of SCREENS) expect(screen.permission.action.startsWith('medium.')).toBe(true);
  });
});
