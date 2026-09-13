import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { httpRequest, type HttpResponse } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';
import type { ErrorBody } from '../../server/errors';
import type { MeResponse } from '../../server/meRoute';
import { DASHBOARD_PORTAL_ACCESS_MESSAGE, PORTAL_OWNER_MESSAGE, PUBLISHED_ASSET_MESSAGE, PUBLISHED_PORTAL_MESSAGE } from '../server/permissions';
import { seed } from '../server/store';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface MatrixRow {
  readonly user: string | undefined;
  readonly method: Method;
  readonly path: string;
  readonly body?: unknown;
  readonly status: number;
  readonly code?: string;
}

const ASSET_BODY = { title: 'Spring banner', campaign: 'spring', status: 'draft' };
const PORTAL_EDIT = { name: 'Renamed' };
const GRANT_FIELDS = ['assetId', 'id', 'name'];
const FULL_PORTAL_FIELDS = ['assetId', 'id', 'internalNotes', 'name', 'owner', 'status'];

const MATRIX: readonly MatrixRow[] = [
  { user: undefined, method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: undefined, method: 'GET', path: '/marketing/portals', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: '/campaigns/assets', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ava', method: 'GET', path: '/me', status: 200 },
  { user: 'ava', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'ava', method: 'GET', path: '/marketing/portals', status: 200 },
  { user: 'ava', method: 'DELETE', path: '/marketing/portals/p1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'ava', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'ava', method: 'PATCH', path: '/marketing/portals/editable/p1', body: PORTAL_EDIT, status: 403, code: 'METHOD_DISABLED' },
  { user: 'ava', method: 'GET', path: '/campaigns/assets', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ava', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ben', method: 'GET', path: '/me', status: 200 },
  { user: 'ben', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'ben', method: 'GET', path: '/marketing/portals', status: 200 },
  { user: 'ben', method: 'DELETE', path: '/marketing/portals/p1', status: 204 },
  { user: 'ben', method: 'DELETE', path: '/marketing/portals/p2', status: 403, code: 'HOOK_ERROR' },
  { user: 'ben', method: 'DELETE', path: '/marketing/portals/p999', status: 404, code: 'NOT_FOUND' },
  { user: 'ben', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'ben', method: 'PATCH', path: '/marketing/portals/editable/p1', body: PORTAL_EDIT, status: 403, code: 'METHOD_DISABLED' },
  { user: 'ben', method: 'GET', path: '/campaigns/assets', status: 200 },
  { user: 'ben', method: 'POST', path: '/campaigns/assets', body: ASSET_BODY, status: 201 },
  { user: 'ben', method: 'POST', path: '/campaigns/assets', body: { ...ASSET_BODY, budget: 10 }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'ben', method: 'PATCH', path: '/campaigns/assets/a1', body: { status: 'published' }, status: 200 },
  { user: 'ben', method: 'PATCH', path: '/campaigns/assets/a999', body: { status: 'published' }, status: 404, code: 'NOT_FOUND' },
  { user: 'ben', method: 'DELETE', path: '/campaigns/assets/a1', status: 204 },
  { user: 'ben', method: 'DELETE', path: '/campaigns/assets/a2', status: 403, code: 'HOOK_ERROR' },
  { user: 'ben', method: 'POST', path: '/campaigns/assets', body: { ...ASSET_BODY, title: ' ' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'ben', method: 'GET', path: '/campaigns/assets/editable', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ben', method: 'GET', path: '/catalog', status: 200 },
  { user: 'sam', method: 'GET', path: '/me', status: 200 },
  { user: 'sam', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'sam', method: 'GET', path: '/marketing/portals', status: 200 },
  { user: 'sam', method: 'DELETE', path: '/marketing/portals/p1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'sam', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'sam', method: 'PATCH', path: '/marketing/portals/editable/p1', body: PORTAL_EDIT, status: 403, code: 'METHOD_DISABLED' },
  { user: 'sam', method: 'GET', path: '/campaigns/assets', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'sam', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'tess', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'tess', method: 'GET', path: '/marketing/portals', status: 403, code: 'HOOK_ERROR' },
  { user: 'tess', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'cleo', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'cleo', method: 'GET', path: '/marketing/portals', status: 200 },
  { user: 'cleo', method: 'DELETE', path: '/marketing/portals/p1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'cleo', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'dev', method: 'GET', path: '/marketing/dashboard', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'dev', method: 'GET', path: '/marketing/portals', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'dev', method: 'GET', path: '/marketing/portals/editable', status: 200 },
  { user: 'dev', method: 'PATCH', path: '/marketing/portals/editable/p1', body: PORTAL_EDIT, status: 200 },
  { user: 'dev', method: 'PATCH', path: '/marketing/portals/editable/p2', body: PORTAL_EDIT, status: 403, code: 'HOOK_ERROR' },
  { user: 'dev', method: 'PATCH', path: '/marketing/portals/editable/p1', body: { status: 'published' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'dev', method: 'PATCH', path: '/marketing/portals/editable/p999', body: PORTAL_EDIT, status: 404, code: 'NOT_FOUND' },
  { user: 'eve', method: 'GET', path: '/marketing/portals', status: 200 },
  { user: 'eve', method: 'GET', path: '/marketing/portals/editable', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'eve', method: 'PATCH', path: '/marketing/portals/editable/p1', body: PORTAL_EDIT, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'nil', method: 'GET', path: '/me', status: 200 },
  { user: 'nil', method: 'GET', path: '/marketing/portals', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'nil', method: 'GET', path: '/marketing/dashboard', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'mal', method: 'GET', path: '/me', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'mal', method: 'GET', path: '/marketing/dashboard', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'mal', method: 'GET', path: '/marketing/portals', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'mal', method: 'GET', path: '/campaigns/assets', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'mal', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'old', method: 'GET', path: '/me', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'old', method: 'GET', path: '/marketing/dashboard', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'old', method: 'GET', path: '/marketing/portals', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'old', method: 'GET', path: '/marketing/portals/editable', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'old', method: 'GET', path: '/campaigns/assets', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'old', method: 'GET', path: '/catalog', status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'ana', method: 'GET', path: '/marketing/dashboard', status: 200 },
  { user: 'ana', method: 'GET', path: '/marketing/portals', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ana', method: 'GET', path: '/campaigns/assets', status: 200 },
  { user: 'ana', method: 'POST', path: '/campaigns/assets', body: ASSET_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'ana', method: 'DELETE', path: '/campaigns/assets/a1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'ana', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ian', method: 'GET', path: '/marketing/dashboard', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ian', method: 'GET', path: '/campaigns/assets', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ian', method: 'GET', path: '/campaigns/assets/editable', status: 200 },
  { user: 'ian', method: 'PATCH', path: '/campaigns/assets/editable/a1', body: { title: 'Retitled' }, status: 200 },
  { user: 'ian', method: 'PATCH', path: '/campaigns/assets/editable/a2', body: { title: 'Retitled' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'ian', method: 'PATCH', path: '/campaigns/assets/editable/a1', body: { status: 'draft' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'ian', method: 'PATCH', path: '/campaigns/assets/editable/a999', body: { title: 'x' }, status: 404, code: 'NOT_FOUND' },
  { user: 'ben', method: 'POST', path: '/campaigns/assets', body: 'not-an-object', status: 400, code: 'INVALID_BODY' },
  { user: 'dev', method: 'PATCH', path: '/marketing/portals/editable/p1', body: ['x'], status: 400, code: 'INVALID_BODY' },
];

let server: RunningServer;

function errorCode(response: HttpResponse<unknown>): string | undefined {
  return (response.body as ErrorBody | undefined)?.error?.code;
}

async function listKeys(path: string, userId: string): Promise<readonly string[]> {
  const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: `/api/medium${path}`, userId });
  expect(response.status).toBe(200);
  return Object.keys(response.body[0] ?? {}).sort();
}

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  seed();
});

describe('medium: user × route × method matrix', () => {
  for (const row of MATRIX) {
    const label = `${row.user ?? 'no header'} ${row.method} ${row.path} → ${row.status}${row.code === undefined ? '' : ` ${row.code}`}`;
    test(label, async () => {
      const response = await httpRequest({ baseUrl: server.baseUrl, path: `/api/medium${row.path}`, method: row.method, userId: row.user, body: row.body });
      expect(response.status).toBe(row.status);
      if (row.code !== undefined) expect(errorCode(response)).toBe(row.code);
    });
  }
});

describe('medium: USAGE.md "Con las definiciones del ejemplo" rows', () => {
  test('row 1: admin with only dashboard finds portals all with the three grant fields, not the admin wildcard', async () => {
    expect(await listKeys('/marketing/portals', 'ava')).toEqual(GRANT_FIELDS);
  });

  test('row 2: admin with dashboard and portals all gets the full record because the direct definition wins', async () => {
    expect(await listKeys('/marketing/portals', 'ben')).toEqual(FULL_PORTAL_FIELDS);
  });

  test('row 3: staff with only dashboard gets the three grant fields and the staff hook runs', async () => {
    expect(await listKeys('/marketing/portals', 'sam')).toEqual(GRANT_FIELDS);
    const denied = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals', userId: 'tess' });
    expect(denied.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [DASHBOARD_PORTAL_ACCESS_MESSAGE] } });
  });

  test('row 4: staff with dashboard and portals all gets the direct staff fields', async () => {
    expect(await listKeys('/marketing/portals', 'cleo')).toEqual(GRANT_FIELDS);
  });

  test('row 5: admin with only dashboard finds portals update-only without an admin definition', async () => {
    expect(await listKeys('/marketing/portals/editable', 'ava')).toEqual(GRANT_FIELDS);
  });

  test('row 6: staff with only dashboard cannot update portals update-only (grant gives find only)', async () => {
    const response = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable/p1', method: 'PATCH', userId: 'sam', body: PORTAL_EDIT });
    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe('METHOD_DISABLED');
  });

  test('row 7: staff with portals update-only updates its own portal with the three fields', async () => {
    const response = await httpRequest<Record<string, unknown>>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable/p1', method: 'PATCH', userId: 'dev', body: { name: 'Renamed', assetId: 'a2' } });
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Renamed');
    expect(response.body.assetId).toBe('a2');
  });

  test('row 8: staff with portals all is not assigned to portals update-only', async () => {
    const response = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable', userId: 'eve' });
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('row 9: admin without assignments is not assigned and has an empty access map', async () => {
    const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/medium/me', userId: 'nil' });
    expect(me.body.access).toEqual({});
    const portals = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals', userId: 'nil' });
    expect(errorCode(portals)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('row 10: staff with an injected admin row is rejected everywhere', async () => {
    for (const path of ['/me', '/marketing/dashboard', '/marketing/portals/editable', '/campaigns/assets/editable']) {
      const response = await httpRequest({ baseUrl: server.baseUrl, path: `/api/medium${path}`, userId: 'mal' });
      expect(errorCode(response)).toBe('PERMISSION_ROLE_MISMATCH');
    }
  });

  test('row 11: staff with a row whose name no longer exists is rejected everywhere', async () => {
    for (const path of ['/me', '/marketing/dashboard', '/campaigns/assets/editable']) {
      const response = await httpRequest({ baseUrl: server.baseUrl, path: `/api/medium${path}`, userId: 'old' });
      expect(errorCode(response)).toBe('UNKNOWN_PERMISSION');
    }
  });
});

describe('medium: projections and select', () => {
  test('grant projection ignores select fields outside the grant', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals?select=id,name,internalNotes', userId: 'ava' });
    expect(Object.keys(response.body[0] ?? {}).sort()).toEqual(['id', 'name']);
  });

  test('wildcard select of a subset is honoured', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals?select=id,status', userId: 'ben' });
    expect(response.body).toEqual([{ id: 'p1', status: 'draft' }, { id: 'p2', status: 'published' }]);
  });

  test('dashboard find with * returns the full widget for every role', async () => {
    for (const user of ['ava', 'sam', 'ana']) {
      expect(await listKeys('/marketing/dashboard', user)).toEqual(['conversions', 'id', 'title', 'visitors']);
    }
  });

  test('analyst sees only its asset fields and the intern only the update-only fields', async () => {
    expect(await listKeys('/campaigns/assets', 'ana')).toEqual(['campaign', 'id', 'status', 'title']);
    expect(await listKeys('/campaigns/assets/editable', 'ian')).toEqual(['campaign', 'id', 'title']);
    expect(await listKeys('/campaigns/assets', 'ben')).toEqual(['budget', 'campaign', 'id', 'status', 'title']);
  });

  test('/me for staff with only dashboard matches the USAGE.md forUser example under the prefix', async () => {
    const me = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/medium/me', userId: 'sam' });
    expect(me.body.access).toEqual({
      'staff::medium.marketing.portals::all': { find: true, update: false, create: false, remove: false },
      'staff::medium.marketing.portals::update-only': { find: true, update: false, create: false, remove: false },
      'staff::medium.marketing.dashboard::all': { find: true, update: false, create: false, remove: false },
    });
  });
});

describe('medium: hooks', () => {
  test('module hook denies removing a published portal with a stable reason', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/p2', method: 'DELETE', userId: 'ben' });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [PUBLISHED_PORTAL_MESSAGE] } });
    const after = await httpRequest<readonly { id: string }[]>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals', userId: 'ben' });
    expect(after.body.map((portal) => portal.id)).toEqual(['p1', 'p2']);
  });

  test('name+role hook denies a staff update of a portal owned by someone else', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable/p2', method: 'PATCH', userId: 'dev', body: PORTAL_EDIT });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [PORTAL_OWNER_MESSAGE] } });
  });

  test('name+role hook on portals all acts only on access granted by the dashboard', async () => {
    const direct = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals', userId: 'cleo' });
    expect(direct.status).toBe(200);
    const admin = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals', userId: 'ava' });
    expect(admin.status).toBe(200);
    const editable = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable', userId: 'tess' });
    expect(editable.status).toBe(200);
  });

  test('name hook denies editing a published asset for every role of update-only', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/campaigns/assets/editable/a2', method: 'PATCH', userId: 'ian', body: { title: 'x' } });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [PUBLISHED_ASSET_MESSAGE] } });
  });

  test('a denied write leaves the store untouched', async () => {
    await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable/p1', method: 'PATCH', userId: 'dev', body: { name: 'x', status: 'published' } });
    const after = await httpRequest<readonly { id: string; name: string }[]>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable', userId: 'dev' });
    expect(after.body.find((portal) => portal.id === 'p1')?.name).toBe('Launch portal');
  });
});

describe('medium: identity is never read from the body', () => {
  test('role and permissions in the body do not lift a denial', async () => {
    const response = await httpRequest({ baseUrl: server.baseUrl, path: '/api/medium/campaigns/assets', method: 'POST', userId: 'ana', body: { ...ASSET_BODY, role: 'admin', permissions: ['admin::medium.campaigns.assets::all'] } });
    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe('METHOD_DISABLED');
  });

  test('role and permissions in the body are treated as data and rejected', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/campaigns/assets', method: 'POST', userId: 'ben', body: { ...ASSET_BODY, role: 'admin', permissions: [] } });
    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['role', 'permissions'] });
  });

  test('PROPERTIES_NOT_ALLOWED lists the rejected fields in body order', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/medium/marketing/portals/editable/p1', method: 'PATCH', userId: 'dev', body: { owner: 'dev', name: 'x', status: 'draft' } });
    expect(response.body.error.fields).toEqual(['owner', 'status']);
  });

  test('catalog is filtered to the medium prefix and lists only assignable ids', async () => {
    const response = await httpRequest<Record<string, unknown>>({ baseUrl: server.baseUrl, path: '/api/medium/catalog', userId: 'ben' });
    expect(Object.keys(response.body).sort()).toEqual([
      'admin::medium.campaigns.assets::all',
      'admin::medium.marketing.dashboard::all',
      'admin::medium.marketing.dashboard::settings',
      'admin::medium.marketing.portals::all',
      'analyst::medium.campaigns.assets::all',
      'analyst::medium.marketing.dashboard::all',
      'intern::medium.campaigns.assets::update-only',
      'staff::medium.marketing.dashboard::all',
      'staff::medium.marketing.portals::all',
      'staff::medium.marketing.portals::update-only',
    ]);
  });
});
