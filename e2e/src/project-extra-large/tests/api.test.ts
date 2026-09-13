import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { httpRequest, type HttpResponse } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';
import type { ErrorBody } from '../../server/errors';
import type { MeResponse } from '../../server/meRoute';
import {
  CLOSED_TICKET_MESSAGE,
  GRANTED_INTERNAL_REPLIES_MESSAGE,
  LARGE_ENTRY_MESSAGE,
  MISSING_TENANT_CONTEXT_MESSAGE,
  NON_POSITIVE_AMOUNT_MESSAGE,
  NOTE_AUTHOR_MESSAGE,
  OWNER_MEMBER_MESSAGE,
  PINNED_REPORT_MESSAGE,
  RECONCILED_ENTRY_MESSAGE,
} from '../server/permissions';
import { seed } from '../server/store';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface MatrixRow {
  readonly user: string | undefined;
  readonly method: Method;
  readonly path: string;
  readonly body?: unknown;
  readonly status: number;
  readonly code?: string;
}

const API = '/api/extra-large';
const MINIMUM_ASSIGNABLE_IDS = 25;
const CONCURRENT_REQUESTS = 60;

const SETTINGS = '/platform/tenants/settings';
const MEMBERS = '/platform/tenants/members';
const NOTES = '/crm/accounts/contacts/notes';
const REPLIES = '/support/tickets/replies';
const ENTRIES = '/finance/ledger/entries';
const PUBLISHED = '/content/pages/published';
const BLOCKS = '/content/pages/blocks';
const REPORTS = '/analytics/reports';

const TENANT_BODY = { name: 'Initech', plan: 'starter', locale: 'en' };
const MEMBER_BODY = { email: 'new@acme.test', role: 'agent', tenantId: 'tn1' };
const NOTE_BODY = { contactId: 'c1', body: 'Follow up' };
const REPLY_BODY = { ticketId: 'tk1', body: 'On it' };
const ENTRY_BODY = { amount: 10, memo: 'Stamps', account: 'expenses' };
const BLOCK_BODY = { pageId: 'pg1', kind: 'text', text: 'Hello' };
const REPORT_BODY = { title: 'Growth', query: 'select growth' };

const MATRIX: readonly MatrixRow[] = [
  { user: undefined, method: 'GET', path: '/me', status: 200 },
  { user: undefined, method: 'GET', path: PUBLISHED, status: 200 },
  { user: undefined, method: 'GET', path: BLOCKS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'GET', path: SETTINGS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'PUT', path: '/users/zero/permissions', body: { permissions: [] }, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'olivia', method: 'GET', path: '/me', status: 200 },
  { user: 'olivia', method: 'GET', path: '/catalog', status: 200 },
  { user: 'olivia', method: 'GET', path: SETTINGS, status: 200 },
  { user: 'olivia', method: 'POST', path: SETTINGS, body: { ...TENANT_BODY, apiKey: 'k' }, status: 201 },
  { user: 'olivia', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { apiKey: 'rotated' }, status: 200 },
  { user: 'olivia', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { name: ' ' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'DELETE', path: `${SETTINGS}/tn2`, status: 204 },
  { user: 'olivia', method: 'DELETE', path: `${SETTINGS}/tn99`, status: 404, code: 'NOT_FOUND' },
  { user: 'olivia', method: 'GET', path: MEMBERS, status: 200 },
  { user: 'olivia', method: 'POST', path: MEMBERS, body: MEMBER_BODY, status: 201 },
  { user: 'olivia', method: 'POST', path: `${MEMBERS}/import`, body: MEMBER_BODY, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'DELETE', path: `${MEMBERS}/mb1`, status: 204 },
  { user: 'olivia', method: 'GET', path: NOTES, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'olivia', method: 'GET', path: REPLIES, status: 200 },
  { user: 'olivia', method: 'POST', path: REPLIES, body: REPLY_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'olivia', method: 'DELETE', path: `${REPLIES}/rp1`, status: 204 },
  { user: 'olivia', method: 'GET', path: ENTRIES, status: 200 },
  { user: 'olivia', method: 'GET', path: `${ENTRIES}/summary`, status: 200 },
  { user: 'olivia', method: 'POST', path: ENTRIES, body: ENTRY_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'olivia', method: 'DELETE', path: `${ENTRIES}/le1`, status: 204 },
  { user: 'olivia', method: 'DELETE', path: `${ENTRIES}/le2`, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'DELETE', path: `${ENTRIES}/le3`, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'GET', path: BLOCKS, status: 200 },
  { user: 'olivia', method: 'POST', path: BLOCKS, body: { ...BLOCK_BODY, draft: true }, status: 201 },
  { user: 'olivia', method: 'POST', path: BLOCKS, body: { pageId: 'pg1', text: 'no kind' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'GET', path: REPORTS, status: 200 },
  { user: 'olivia', method: 'POST', path: REPORTS, body: REPORT_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'olivia', method: 'PATCH', path: `${REPORTS}/rt1`, body: { pinned: false }, status: 200 },
  { user: 'olivia', method: 'DELETE', path: `${REPORTS}/rt1`, status: 403, code: 'HOOK_ERROR' },
  { user: 'olivia', method: 'DELETE', path: `${REPORTS}/rt2`, status: 204 },
  { user: 'olivia', method: 'PUT', path: '/users/zero/permissions', body: { permissions: ['author::xl.content.pages.blocks::all'] }, status: 200 },

  { user: 'oscar', method: 'GET', path: SETTINGS, status: 200 },
  { user: 'oscar', method: 'GET', path: MEMBERS, status: 200 },
  { user: 'oscar', method: 'POST', path: MEMBERS, body: MEMBER_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'oscar', method: 'GET', path: `${ENTRIES}/summary`, status: 200 },
  { user: 'oscar', method: 'GET', path: ENTRIES, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'adam', method: 'GET', path: '/catalog', status: 200 },
  { user: 'adam', method: 'GET', path: SETTINGS, status: 200 },
  { user: 'adam', method: 'POST', path: SETTINGS, body: TENANT_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'adam', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { name: 'Acme Corp' }, status: 200 },
  { user: 'adam', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { plan: 'free' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'adam', method: 'DELETE', path: `${SETTINGS}/tn1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'adam', method: 'GET', path: MEMBERS, status: 200 },
  { user: 'adam', method: 'POST', path: MEMBERS, body: MEMBER_BODY, status: 201 },
  { user: 'adam', method: 'POST', path: MEMBERS, body: { ...MEMBER_BODY, invitedBy: 'me' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'adam', method: 'PATCH', path: `${MEMBERS}/mb2`, body: { role: 'agent' }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'adam', method: 'DELETE', path: `${MEMBERS}/mb2`, status: 204 },
  { user: 'adam', method: 'DELETE', path: `${MEMBERS}/mb1`, status: 403, code: 'HOOK_ERROR' },
  { user: 'adam', method: 'GET', path: NOTES, status: 200 },
  { user: 'adam', method: 'POST', path: NOTES, body: NOTE_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'adam', method: 'DELETE', path: `${NOTES}/cn1`, status: 204 },
  { user: 'adam', method: 'GET', path: REPLIES, status: 200 },
  { user: 'adam', method: 'GET', path: `${REPLIES}?scope=internal`, status: 200 },
  { user: 'adam', method: 'DELETE', path: `${REPLIES}/rp2`, status: 204 },
  { user: 'adam', method: 'GET', path: BLOCKS, status: 200 },
  { user: 'adam', method: 'DELETE', path: `${BLOCKS}/bk1`, status: 204 },
  { user: 'adam', method: 'GET', path: REPORTS, status: 200 },
  { user: 'adam', method: 'PATCH', path: `${REPORTS}/rt1`, body: { title: 'x' }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'adam', method: 'GET', path: ENTRIES, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: [] }, status: 200 },
  { user: 'adam', method: 'PUT', path: '/users/nobody/permissions', body: { permissions: [] }, status: 404, code: 'NOT_FOUND' },
  { user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: 'author::xl.content.pages.blocks::all' }, status: 400, code: 'INVALID_BODY' },
  { user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: ['agent::xl.crm.accounts.contacts.notes::all'] }, status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: ['author::xl.content.pages::draft'] }, status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: ['not-an-id'] }, status: 400, code: 'INVALID_INPUT' },

  { user: 'ana', method: 'GET', path: MEMBERS, status: 200 },
  { user: 'ana', method: 'GET', path: NOTES, status: 200 },
  { user: 'ana', method: 'DELETE', path: `${NOTES}/cn1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'ana', method: 'GET', path: REPLIES, status: 200 },
  { user: 'ana', method: 'GET', path: `${REPLIES}?scope=internal`, status: 403, code: 'HOOK_ERROR' },
  { user: 'ana', method: 'GET', path: SETTINGS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ana', method: 'GET', path: BLOCKS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ana', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'gus', method: 'GET', path: NOTES, status: 200 },
  { user: 'gus', method: 'POST', path: NOTES, body: NOTE_BODY, status: 201 },
  { user: 'gus', method: 'POST', path: NOTES, body: { contactId: 'c1', body: '' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'gus', method: 'PATCH', path: `${NOTES}/cn1`, body: { body: 'Edited' }, status: 200 },
  { user: 'gus', method: 'PATCH', path: `${NOTES}/cn2`, body: { body: 'Edited' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'gus', method: 'PATCH', path: `${NOTES}/cn1`, body: { author: 'gia' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'gus', method: 'DELETE', path: `${NOTES}/cn1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'gus', method: 'GET', path: `${NOTES}/read-only`, status: 200 },
  { user: 'gus', method: 'GET', path: REPLIES, status: 200 },
  { user: 'gus', method: 'GET', path: `${REPLIES}?scope=internal`, status: 200 },
  { user: 'gus', method: 'POST', path: REPLIES, body: REPLY_BODY, status: 201 },
  { user: 'gus', method: 'POST', path: REPLIES, body: { ...REPLY_BODY, ticketId: 'tk2' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'gus', method: 'POST', path: REPLIES, body: { ...REPLY_BODY, ticketId: 'tk9' }, status: 404, code: 'NOT_FOUND' },
  { user: 'gus', method: 'PATCH', path: `${REPLIES}/rp1`, body: { body: 'Fixed' }, status: 200 },
  { user: 'gus', method: 'DELETE', path: `${REPLIES}/rp1`, status: 204 },
  { user: 'gus', method: 'GET', path: `${REPORTS}/read-only`, status: 200 },
  { user: 'gus', method: 'GET', path: REPORTS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'gia', method: 'GET', path: REPLIES, status: 200 },
  { user: 'gia', method: 'POST', path: REPLIES, body: REPLY_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'gia', method: 'GET', path: `${NOTES}/read-only`, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'dupe', method: 'GET', path: '/me', status: 200 },
  { user: 'dupe', method: 'GET', path: REPLIES, status: 200 },

  { user: 'nina', method: 'GET', path: REPORTS, status: 200 },
  { user: 'nina', method: 'POST', path: REPORTS, body: REPORT_BODY, status: 201 },
  { user: 'nina', method: 'PATCH', path: `${REPORTS}/rt2`, body: { title: 'Revenue 2026' }, status: 200 },
  { user: 'nina', method: 'PATCH', path: `${REPORTS}/rt2`, body: { pinned: true }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'nina', method: 'DELETE', path: `${REPORTS}/rt1`, status: 403, code: 'HOOK_ERROR' },
  { user: 'nina', method: 'DELETE', path: `${REPORTS}/rt2`, status: 204 },
  { user: 'nina', method: 'GET', path: `${NOTES}/read-only`, status: 200 },
  { user: 'nina', method: 'GET', path: NOTES, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'nina', method: 'GET', path: `${ENTRIES}/summary`, status: 200 },
  { user: 'nina', method: 'GET', path: ENTRIES, status: 200 },
  { user: 'nina', method: 'POST', path: ENTRIES, body: ENTRY_BODY, status: 403, code: 'METHOD_DISABLED' },

  { user: 'fin', method: 'GET', path: ENTRIES, status: 200 },
  { user: 'fin', method: 'POST', path: ENTRIES, body: ENTRY_BODY, status: 201 },
  { user: 'fin', method: 'POST', path: ENTRIES, body: { ...ENTRY_BODY, amount: -5 }, status: 403, code: 'HOOK_ERROR' },
  { user: 'fin', method: 'POST', path: ENTRIES, body: { ...ENTRY_BODY, reconciled: true }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'fin', method: 'PATCH', path: `${ENTRIES}/le1`, body: { memo: 'Paper' }, status: 200 },
  { user: 'fin', method: 'DELETE', path: `${ENTRIES}/le1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'fin', method: 'GET', path: `${ENTRIES}/summary`, status: 200 },
  { user: 'fin', method: 'GET', path: `${REPORTS}/read-only`, status: 200 },
  { user: 'fin', method: 'GET', path: REPORTS, status: 200 },
  { user: 'fin', method: 'POST', path: REPORTS, body: REPORT_BODY, status: 403, code: 'METHOD_DISABLED' },

  { user: 'aria', method: 'GET', path: BLOCKS, status: 200 },
  { user: 'aria', method: 'POST', path: BLOCKS, body: BLOCK_BODY, status: 201 },
  { user: 'aria', method: 'POST', path: BLOCKS, body: { ...BLOCK_BODY, draft: true }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'aria', method: 'PATCH', path: `${BLOCKS}/bk1`, body: { text: 'Hi' }, status: 200 },
  { user: 'aria', method: 'DELETE', path: `${BLOCKS}/bk2`, status: 204 },
  { user: 'aria', method: 'GET', path: PUBLISHED, status: 200 },
  { user: 'aria', method: 'GET', path: SETTINGS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'audrey', method: 'GET', path: SETTINGS, status: 200 },
  { user: 'audrey', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { name: 'x' }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'DELETE', path: `${SETTINGS}/tn1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'GET', path: MEMBERS, status: 200 },
  { user: 'audrey', method: 'POST', path: MEMBERS, body: MEMBER_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'GET', path: `${NOTES}/read-only`, status: 200 },
  { user: 'audrey', method: 'GET', path: REPLIES, status: 200 },
  { user: 'audrey', method: 'PATCH', path: `${REPLIES}/rp1`, body: { body: 'x' }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'GET', path: ENTRIES, status: 200 },
  { user: 'audrey', method: 'POST', path: ENTRIES, body: ENTRY_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'DELETE', path: `${ENTRIES}/le1`, status: 403, code: 'METHOD_DISABLED' },
  { user: 'audrey', method: 'GET', path: `${REPORTS}/read-only`, status: 200 },
  { user: 'audrey', method: 'GET', path: '/catalog', status: 200 },
  { user: 'audrey', method: 'PUT', path: '/users/zero/permissions', body: { permissions: [] }, status: 403, code: 'METHOD_DISABLED' },

  { user: 'zero', method: 'GET', path: '/me', status: 200 },
  { user: 'zero', method: 'GET', path: BLOCKS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'zero', method: 'GET', path: PUBLISHED, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },

  { user: 'rook', method: 'GET', path: '/me', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rook', method: 'GET', path: NOTES, status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rook', method: 'GET', path: PUBLISHED, status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rook', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },

  { user: 'ghost', method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: PUBLISHED, status: 401, code: 'UNKNOWN_USER' },

  { user: 'gus', method: 'POST', path: NOTES, body: 'not-an-object', status: 400, code: 'INVALID_BODY' },
  { user: 'gus', method: 'POST', path: NOTES, body: { ...NOTE_BODY, contactId: { nested: true } }, status: 400, code: 'INVALID_BODY' },
];

let server: RunningServer;

function errorCode(response: HttpResponse<unknown>): string | undefined {
  return (response.body as ErrorBody | undefined)?.error?.code;
}

function request<Body = unknown>(row: Pick<MatrixRow, 'user' | 'method' | 'path' | 'body'>): Promise<HttpResponse<Body>> {
  return httpRequest<Body>({ baseUrl: server.baseUrl, path: `${API}${row.path}`, method: row.method, userId: row.user, body: row.body });
}

function keysOfFirst(response: HttpResponse<readonly Record<string, unknown>[]>): readonly string[] {
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

describe('extra-large: user × route × method matrix', () => {
  for (const row of MATRIX) {
    const label = `${row.user ?? 'anonymous'} ${row.method} ${row.path} → ${row.status}${row.code === undefined ? '' : ` ${row.code}`}`;
    test(label, async () => {
      const response = await request(row);
      expect(response.status).toBe(row.status);
      if (row.code !== undefined) expect(errorCode(response)).toBe(row.code);
    });
  }
});

describe('extra-large: catalog and minimums', () => {
  test(`catalog lists at least ${MINIMUM_ASSIGNABLE_IDS} assignable xl identifiers and nothing else`, async () => {
    const response = await request<Record<string, unknown>>({ user: 'adam', method: 'GET', path: '/catalog' });
    const ids = Object.keys(response.body);
    expect(ids.length).toBeGreaterThanOrEqual(MINIMUM_ASSIGNABLE_IDS);
    for (const id of ids) expect(id.split('::')[1]?.startsWith('xl.')).toBe(true);
    const roles = new Set(ids.map((id) => id.split('::')[0]));
    expect([...roles].sort()).toEqual(['admin', 'agent', 'analyst', 'auditor', 'author', 'finance', 'owner', 'public']);
  });

  test('catalog excludes identifiers reachable only by grant', async () => {
    const response = await request<Record<string, unknown>>({ user: 'adam', method: 'GET', path: '/catalog' });
    expect(response.body['auditor::xl.platform.tenants.settings::all']).toBeDefined();
    expect(response.body['analyst::xl.finance.ledger.entries::all']).toBeUndefined();
    expect(response.body['finance::xl.analytics.reports::all']).toBeUndefined();
  });
});

describe('extra-large: projections', () => {
  test('anonymous published pages expose id, title and slug only', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: undefined, method: 'GET', path: PUBLISHED });
    expect(keysOfFirst(response)).toEqual(['id', 'slug', 'title']);
  });

  test('owner with * on settings receives the full tenant record including apiKey', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'olivia', method: 'GET', path: SETTINGS });
    expect(keysOfFirst(response)).toEqual(['apiKey', 'id', 'locale', 'name', 'plan']);
  });

  test('admin settings find without select returns the four permitted fields', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'adam', method: 'GET', path: SETTINGS });
    expect(keysOfFirst(response)).toEqual(['id', 'locale', 'name', 'plan']);
  });

  test('select outside the permitted fields is trimmed silently', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'adam', method: 'GET', path: `${SETTINGS}?select=id,apiKey,name` });
    expect(keysOfFirst(response)).toEqual(['id', 'name']);
  });

  test('direct assignment wins over a grant: olivia sees full members, oscar sees the grant projection', async () => {
    const direct = await request<readonly Record<string, unknown>[]>({ user: 'olivia', method: 'GET', path: MEMBERS });
    const granted = await request<readonly Record<string, unknown>[]>({ user: 'oscar', method: 'GET', path: MEMBERS });
    expect(keysOfFirst(direct)).toEqual(['email', 'id', 'invitedBy', 'role', 'tenantId']);
    expect(keysOfFirst(granted)).toEqual(['email', 'id', 'role']);
  });

  test('two grants toward replies unite their fields for gia', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'gia', method: 'GET', path: REPLIES });
    expect(keysOfFirst(response)).toEqual(['author', 'body', 'id', 'ticketId']);
  });

  test('grants are one hop: gia does not reach notes read-only through replies gained by grant', async () => {
    const response = await request({ user: 'gia', method: 'GET', path: `${NOTES}/read-only` });
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('gus reaches notes read-only through the replies grant', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'gus', method: 'GET', path: `${NOTES}/read-only` });
    expect(keysOfFirst(response)).toEqual(['contactId', 'id']);
  });

  test('valid cycle: fin reads reports through entries and nina reads entries through reports', async () => {
    const reports = await request<readonly Record<string, unknown>[]>({ user: 'fin', method: 'GET', path: REPORTS });
    const entries = await request<readonly Record<string, unknown>[]>({ user: 'nina', method: 'GET', path: ENTRIES });
    expect(keysOfFirst(reports)).toEqual(['id', 'title']);
    expect(keysOfFirst(entries)).toEqual(['account', 'amount', 'id']);
  });

  test('names do not merge: fin has summary and all on entries with different projections', async () => {
    const summary = await request<readonly Record<string, unknown>[]>({ user: 'fin', method: 'GET', path: `${ENTRIES}/summary` });
    const all = await request<readonly Record<string, unknown>[]>({ user: 'fin', method: 'GET', path: ENTRIES });
    expect(keysOfFirst(summary)).toEqual(['account', 'amount', 'id', 'memo']);
    expect(keysOfFirst(all)).toEqual(['account', 'amount', 'id', 'memo', 'reconciled']);
  });

  test('author reaches published pages only through the blocks grant', async () => {
    const response = await request<readonly Record<string, unknown>[]>({ user: 'aria', method: 'GET', path: PUBLISHED });
    expect(keysOfFirst(response)).toEqual(['id', 'slug', 'title']);
  });
});

describe('extra-large: hooks', () => {
  test('module hook requiring context fails with a stable message when the use case omits it', async () => {
    const response = await request<ErrorBody>({ user: 'olivia', method: 'POST', path: `${MEMBERS}/import`, body: MEMBER_BODY });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [MISSING_TENANT_CONTEXT_MESSAGE] } });
  });

  test('asynchronous module hook denies replies on closed tickets', async () => {
    const response = await request<ErrorBody>({ user: 'gus', method: 'POST', path: REPLIES, body: { ...REPLY_BODY, ticketId: 'tk2' } });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [CLOSED_TICKET_MESSAGE] } });
  });

  test('module and name hooks fail together in registration order', async () => {
    const response = await request<ErrorBody>({ user: 'olivia', method: 'DELETE', path: `${ENTRIES}/le2` });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [RECONCILED_ENTRY_MESSAGE, LARGE_ENTRY_MESSAGE] } });
  });

  test('only the module hook fails for a small reconciled entry', async () => {
    const response = await request<ErrorBody>({ user: 'olivia', method: 'DELETE', path: `${ENTRIES}/le3` });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [RECONCILED_ENTRY_MESSAGE] } });
  });

  test('name hook enforces note ownership', async () => {
    const response = await request<ErrorBody>({ user: 'gus', method: 'PATCH', path: `${NOTES}/cn2`, body: { body: 'x' } });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [NOTE_AUTHOR_MESSAGE] } });
  });

  test('asynchronous name hook denies removing pinned reports for every role', async () => {
    const analyst = await request<ErrorBody>({ user: 'nina', method: 'DELETE', path: `${REPORTS}/rt1` });
    const owner = await request<ErrorBody>({ user: 'olivia', method: 'DELETE', path: `${REPORTS}/rt1` });
    expect(analyst.body.error.reasons).toEqual([PINNED_REPORT_MESSAGE]);
    expect(owner.body.error.reasons).toEqual([PINNED_REPORT_MESSAGE]);
  });

  test('role hook runs for admin removing an owner member but not for the owner role', async () => {
    const admin = await request<ErrorBody>({ user: 'adam', method: 'DELETE', path: `${MEMBERS}/mb1` });
    const owner = await request({ user: 'olivia', method: 'DELETE', path: `${MEMBERS}/mb1` });
    expect(admin.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [OWNER_MEMBER_MESSAGE] } });
    expect(owner.status).toBe(204);
  });

  test('asynchronous role hook rejects non-positive amounts for finance', async () => {
    const response = await request<ErrorBody>({ user: 'fin', method: 'POST', path: ENTRIES, body: { ...ENTRY_BODY, amount: 0 } });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [NON_POSITIVE_AMOUNT_MESSAGE] } });
  });

  test('role hook acting only on granted access: ana is denied the internal scope, adam is not', async () => {
    const granted = await request<ErrorBody>({ user: 'ana', method: 'GET', path: `${REPLIES}?scope=internal` });
    const direct = await request({ user: 'adam', method: 'GET', path: `${REPLIES}?scope=internal` });
    expect(granted.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [GRANTED_INTERNAL_REPLIES_MESSAGE] } });
    expect(direct.status).toBe(200);
  });

  test('a denied write leaves the store untouched', async () => {
    await request({ user: 'adam', method: 'PATCH', path: `${SETTINGS}/tn1`, body: { name: 'Changed', plan: 'free' } });
    const after = await request<readonly { id: string; name: string }[]>({ user: 'adam', method: 'GET', path: SETTINGS });
    expect(after.body.find((tenant) => tenant.id === 'tn1')?.name).toBe('Acme');
  });

  test('PROPERTIES_NOT_ALLOWED lists rejected fields in body order', async () => {
    const response = await request<ErrorBody>({ user: 'aria', method: 'POST', path: BLOCKS, body: { ...BLOCK_BODY, draft: true, owner: 'me' } });
    expect(response.body.error.fields).toEqual(['draft', 'owner']);
  });
});

describe('extra-large: identity and administration', () => {
  test('anonymous identity uses the fixed public list', async () => {
    const response = await request<MeResponse>({ user: undefined, method: 'GET', path: '/me' });
    expect(response.body).toEqual({
      user: 'anonymous',
      role: 'public',
      access: { 'public::xl.content.pages::published': { find: true, update: false, create: false, remove: false } },
    });
  });

  test('repeated identifiers are deduplicated: dupe behaves like gia and /me lists each id once', async () => {
    const dupe = await request<MeResponse>({ user: 'dupe', method: 'GET', path: '/me' });
    const gia = await request<MeResponse>({ user: 'gia', method: 'GET', path: '/me' });
    expect(dupe.body.access).toEqual(gia.body.access);
    expect(Object.keys(dupe.body.access).length).toBe(3);
    const dupeReplies = await request<readonly Record<string, unknown>[]>({ user: 'dupe', method: 'GET', path: REPLIES });
    const giaReplies = await request<readonly Record<string, unknown>[]>({ user: 'gia', method: 'GET', path: REPLIES });
    expect(dupeReplies.body).toEqual(giaReplies.body);
  });

  test('an empty list yields an empty access map', async () => {
    const response = await request<MeResponse>({ user: 'zero', method: 'GET', path: '/me' });
    expect(response.body.access).toEqual({});
  });

  test('role and permissions in the body do not lift a denial', async () => {
    const response = await request({ user: 'ana', method: 'POST', path: SETTINGS, body: { ...TENANT_BODY, role: 'owner', permissions: ['owner::xl.platform.tenants.settings::all'] } });
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('role and permissions in the body are rejected as data fields', async () => {
    const response = await request<ErrorBody>({ user: 'adam', method: 'POST', path: MEMBERS, body: { ...MEMBER_BODY, role: 'owner', permissions: [] } });
    expect(response.body.error.fields).toEqual(['permissions']);
  });

  test('assigning permissions takes effect on the next request', async () => {
    const before = await request({ user: 'zero', method: 'GET', path: BLOCKS });
    expect(errorCode(before)).toBe('PERMISSION_NOT_ASSIGNED');
    const assignment = await request<{ permissions: readonly string[] }>({ user: 'adam', method: 'PUT', path: '/users/zero/permissions', body: { permissions: ['author::xl.content.pages.blocks::all'] } });
    expect(assignment.body.permissions).toEqual(['author::xl.content.pages.blocks::all']);
    const after = await request<readonly Record<string, unknown>[]>({ user: 'zero', method: 'GET', path: BLOCKS });
    expect(keysOfFirst(after)).toEqual(['id', 'kind', 'pageId', 'text']);
    const published = await request({ user: 'zero', method: 'GET', path: PUBLISHED });
    expect(published.status).toBe(200);
  });

  test('a mismatched role prefix is rejected and nothing is saved', async () => {
    const response = await request({ user: 'adam', method: 'PUT', path: '/users/aria/permissions', body: { permissions: ['author::xl.content.pages.blocks::all', 'admin::xl.platform.tenants.settings::all'] } });
    expect(errorCode(response)).toBe('PERMISSION_ROLE_MISMATCH');
    const me = await request<MeResponse>({ user: 'aria', method: 'GET', path: '/me' });
    expect(Object.keys(me.body.access).sort()).toEqual(['author::xl.content.pages.blocks::all', 'author::xl.content.pages::published']);
  });

  test('removing the grant origin removes derived access but not a direct assignment', async () => {
    await request({ user: 'adam', method: 'PUT', path: '/users/fin/permissions', body: { permissions: ['finance::xl.finance.ledger.entries::summary'] } });
    const reports = await request({ user: 'fin', method: 'GET', path: REPORTS });
    const summary = await request({ user: 'fin', method: 'GET', path: `${ENTRIES}/summary` });
    expect(errorCode(reports)).toBe('PERMISSION_NOT_ASSIGNED');
    expect(summary.status).toBe(200);
  });
});

describe('extra-large: concurrency', () => {
  test(`${CONCURRENT_REQUESTS} parallel requests across users answer without interference`, async () => {
    const readRows = MATRIX.filter((row) => row.method === 'GET');
    const rows = Array.from({ length: CONCURRENT_REQUESTS }, (_, index) => readRows[index % readRows.length]!);
    const startedAt = performance.now();
    const responses = await Promise.all(rows.map((row) => request<readonly Record<string, unknown>[] | MeResponse | ErrorBody>(row)));
    const elapsedMs = performance.now() - startedAt;
    console.log(`extra-large concurrency: ${rows.length} parallel requests in ${elapsedMs.toFixed(1)} ms`);
    responses.forEach((response, index) => {
      const row = rows[index]!;
      expect(response.status).toBe(row.status);
      if (row.code !== undefined) expect(errorCode(response)).toBe(row.code);
    });
    const projections = await Promise.all([
      request<readonly Record<string, unknown>[]>({ user: 'olivia', method: 'GET', path: SETTINGS }),
      request<readonly Record<string, unknown>[]>({ user: 'adam', method: 'GET', path: SETTINGS }),
      request<readonly Record<string, unknown>[]>({ user: 'audrey', method: 'GET', path: SETTINGS }),
      request<readonly Record<string, unknown>[]>({ user: 'gia', method: 'GET', path: REPLIES }),
      request<readonly Record<string, unknown>[]>({ user: 'gus', method: 'GET', path: REPLIES }),
    ]);
    expect(projections.map(keysOfFirst)).toEqual([
      ['apiKey', 'id', 'locale', 'name', 'plan'],
      ['id', 'locale', 'name', 'plan'],
      ['id', 'name', 'plan'],
      ['author', 'body', 'id', 'ticketId'],
      ['author', 'body', 'id', 'internal', 'ticketId'],
    ]);
  });
});
