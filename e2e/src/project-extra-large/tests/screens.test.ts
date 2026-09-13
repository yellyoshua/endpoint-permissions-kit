import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Method } from 'endpoint-permissions-kit';
import { domainOf, visibleScreens } from '../../client/screens';
import SCREENS from '../client/screens';
import type { MeResponse } from '../../server/meRoute';
import { httpRequest } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';

interface ExpectedScreens {
  readonly user: string | undefined;
  readonly screens: Readonly<Record<string, readonly Method[]>>;
}

const MINIMUM_SCREENS = 12;
const ROOT_DOMAINS = ['analytics', 'content', 'crm', 'finance', 'platform', 'support'];

const EXPECTED: readonly ExpectedScreens[] = [
  { user: undefined, screens: { published: ['find'] } },
  {
    user: 'olivia',
    screens: {
      settings: ['find', 'create', 'update', 'remove'],
      users: ['update'],
      members: ['find', 'create', 'update', 'remove'],
      replies: ['find', 'remove'],
      entries: ['find', 'remove'],
      'entries-summary': ['find'],
      blocks: ['find', 'create', 'update', 'remove'],
      reports: ['find', 'update', 'remove'],
    },
  },
  { user: 'oscar', screens: { settings: ['find', 'create', 'update', 'remove'], users: ['update'], members: ['find'], 'entries-summary': ['find'] } },
  {
    user: 'adam',
    screens: {
      settings: ['find', 'update'],
      users: ['update'],
      members: ['find', 'create', 'remove'],
      notes: ['find', 'remove'],
      replies: ['find', 'remove'],
      blocks: ['find', 'remove'],
      reports: ['find'],
    },
  },
  { user: 'ana', screens: { members: ['find', 'create', 'remove'], notes: ['find'], replies: ['find'] } },
  { user: 'gus', screens: { notes: ['find', 'create', 'update'], 'notes-read-only': ['find'], replies: ['find', 'create', 'update', 'remove'], 'reports-read-only': ['find'] } },
  { user: 'gia', screens: { notes: ['find', 'create', 'update'], replies: ['find'], 'reports-read-only': ['find'] } },
  { user: 'nina', screens: { 'notes-read-only': ['find'], entries: ['find'], 'entries-summary': ['find'], reports: ['find', 'create', 'update', 'remove'] } },
  { user: 'fin', screens: { entries: ['find', 'create', 'update'], 'entries-summary': ['find'], reports: ['find'], 'reports-read-only': ['find'] } },
  { user: 'aria', screens: { published: ['find'], blocks: ['find', 'create', 'update', 'remove'] } },
  {
    user: 'audrey',
    screens: { settings: ['find'], members: ['find'], 'notes-read-only': ['find'], replies: ['find'], entries: ['find'], 'reports-read-only': ['find'] },
  },
  { user: 'zero', screens: {} },
];

let server: RunningServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('extra-large: /me access map ↔ screens', () => {
  for (const expected of EXPECTED) {
    test(`${expected.user ?? 'anonymous'} sees ${Object.keys(expected.screens).join(', ') || 'nothing'}`, async () => {
      const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/extra-large/me', userId: expected.user });
      const visible = visibleScreens(SCREENS, me.body.role, me.body.access);
      const actual = Object.fromEntries(visible.map(({ screen, methods }) => [screen.path, methods]));
      expect(actual).toEqual(expected.screens);
    });
  }

  test(`the registry has at least ${MINIMUM_SCREENS} screens across the six root domains with unique paths`, () => {
    expect(SCREENS.length).toBeGreaterThanOrEqual(MINIMUM_SCREENS);
    expect(new Set(SCREENS.map((screen) => screen.path)).size).toBe(SCREENS.length);
    expect([...new Set(SCREENS.map(domainOf))].sort()).toEqual(ROOT_DOMAINS);
  });

  test('every screen declares a permission of the xl prefix', () => {
    for (const screen of SCREENS) expect(screen.permission.action.startsWith('xl.')).toBe(true);
  });
});
