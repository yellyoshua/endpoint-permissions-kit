import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Method } from 'endpoint-permissions-kit';
import { domainOf, visibleScreens } from '../../client/screens';
import SCREENS from '../client/screens';
import type { MeResponse } from '../../server/meRoute';
import { httpRequest } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';

interface ExpectedScreens {
  readonly user: string;
  readonly screens: Readonly<Record<string, readonly Method[]>>;
}

const EXPECTED: readonly ExpectedScreens[] = [
  {
    user: 'ada',
    screens: {
      items: ['find', 'create', 'update', 'remove'],
      stock: ['find', 'create', 'update'],
      orders: ['find', 'create', 'update', 'remove'],
      lines: ['find', 'create', 'update', 'remove'],
      invoices: ['find', 'remove'],
      employees: ['find', 'create', 'update', 'remove'],
      accounts: ['find', 'update'],
    },
  },
  { user: 'max', screens: { items: ['find'], orders: ['find', 'remove'], 'orders-summary': ['find'], invoices: ['find'], employees: ['find'] } },
  { user: 'meg', screens: { items: ['find'], 'orders-summary': ['find'], invoices: ['find'] } },
  { user: 'wes', screens: { items: ['find', 'update'], stock: ['find', 'update'] } },
  { user: 'wil', screens: { items: ['find', 'update'], stock: ['find', 'update'] } },
  { user: 'sam', screens: { orders: ['find', 'create', 'update'], 'orders-status': ['find', 'update'], lines: ['find'], invoices: ['find'] } },
  { user: 'sue', screens: { orders: ['find', 'create', 'update'], lines: ['find', 'create', 'update'], invoices: ['find'] } },
  { user: 'cat', screens: { orders: ['find'], 'orders-summary': ['find'], invoices: ['find', 'create', 'update'] } },
  { user: 'hal', screens: { employees: ['find', 'create', 'update'] } },
  { user: 'nil', screens: {} },
];

let server: RunningServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('large: /me access map ↔ screens', () => {
  for (const expected of EXPECTED) {
    test(`${expected.user} sees ${Object.keys(expected.screens).join(', ') || 'nothing'}`, async () => {
      const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/large/me', userId: expected.user });
      const visible = visibleScreens(SCREENS, me.body.role, me.body.access);
      const actual = Object.fromEntries(visible.map(({ screen, methods }) => [screen.path, methods]));
      expect(actual).toEqual(expected.screens);
    });
  }

  test('every screen declares a permission of the large prefix', () => {
    for (const screen of SCREENS) expect(screen.permission.action.startsWith('large.')).toBe(true);
  });

  test('screens are grouped into the four root domains', () => {
    const domains = new Set(SCREENS.map(domainOf));
    expect([...domains].sort()).toEqual(['billing', 'hr', 'inventory', 'sales']);
    expect(SCREENS.length).toBeGreaterThanOrEqual(8);
  });
});
