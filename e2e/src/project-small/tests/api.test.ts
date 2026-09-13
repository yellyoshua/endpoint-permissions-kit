import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { httpRequest, type HttpResponse } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';
import type { ErrorBody } from '../../server/errors';
import type { MeResponse } from '../../server/meRoute';
import { DUPLICATE_TAG_MESSAGE, PINNED_NOTE_MESSAGE } from '../server/permissions';
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

const NOTE_BODY = { title: 'New', body: 'Body' };
const TAG_BODY = { label: 'fresh', color: 'green' };

const MATRIX: readonly MatrixRow[] = [
  { user: undefined, method: 'GET', path: '/me', status: 200 },
  { user: undefined, method: 'GET', path: '/notes/published', status: 200 },
  { user: undefined, method: 'GET', path: '/notes', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'POST', path: '/notes', body: NOTE_BODY, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'GET', path: '/tags', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'GET', path: '/profile', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: undefined, method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'mia', method: 'GET', path: '/me', status: 200 },
  { user: 'mia', method: 'GET', path: '/notes', status: 200 },
  { user: 'mia', method: 'GET', path: '/notes/published', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'mia', method: 'POST', path: '/notes', body: NOTE_BODY, status: 201 },
  { user: 'mia', method: 'PATCH', path: '/notes/n2', body: { title: 'Edited' }, status: 200 },
  { user: 'mia', method: 'PATCH', path: '/notes/n2', body: { pinned: true }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'mia', method: 'PATCH', path: '/notes/n999', body: { title: 'Edited' }, status: 404, code: 'NOT_FOUND' },
  { user: 'mia', method: 'DELETE', path: '/notes/n2', status: 403, code: 'METHOD_DISABLED' },
  { user: 'mia', method: 'GET', path: '/tags', status: 200 },
  { user: 'mia', method: 'POST', path: '/tags', body: TAG_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'mia', method: 'DELETE', path: '/tags/t1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'mia', method: 'GET', path: '/profile', status: 200 },
  { user: 'mia', method: 'PATCH', path: '/profile', body: { displayName: 'Mia B' }, status: 200 },
  { user: 'mia', method: 'PATCH', path: '/profile', body: { bio: 'x' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'mia', method: 'GET', path: '/catalog', status: 200 },
  { user: 'eli', method: 'GET', path: '/notes', status: 200 },
  { user: 'eli', method: 'POST', path: '/notes', body: { ...NOTE_BODY, pinned: true }, status: 201 },
  { user: 'eli', method: 'PATCH', path: '/notes/n2', body: { pinned: true }, status: 200 },
  { user: 'eli', method: 'DELETE', path: '/notes/n2', status: 204 },
  { user: 'eli', method: 'DELETE', path: '/notes/n1', status: 403, code: 'HOOK_ERROR' },
  { user: 'eli', method: 'DELETE', path: '/notes/n999', status: 404, code: 'NOT_FOUND' },
  { user: 'eli', method: 'GET', path: '/tags', status: 200 },
  { user: 'eli', method: 'POST', path: '/tags', body: TAG_BODY, status: 201 },
  { user: 'eli', method: 'POST', path: '/tags', body: { label: 'urgent', color: 'red' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'eli', method: 'DELETE', path: '/tags/t1', status: 204 },
  { user: 'eli', method: 'GET', path: '/profile', status: 200 },
  { user: 'eli', method: 'PATCH', path: '/profile', body: { bio: 'new bio' }, status: 200 },
  { user: 'eli', method: 'GET', path: '/catalog', status: 200 },
  { user: 'noah', method: 'GET', path: '/notes', status: 200 },
  { user: 'noah', method: 'GET', path: '/tags', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'noah', method: 'GET', path: '/profile', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'noah', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'zed', method: 'GET', path: '/me', status: 200 },
  { user: 'zed', method: 'GET', path: '/notes', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'rook', method: 'GET', path: '/me', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rook', method: 'GET', path: '/notes', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rook', method: 'GET', path: '/tags', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'ghost', method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: '/notes', status: 401, code: 'UNKNOWN_USER' },
  { user: 'mia', method: 'POST', path: '/notes', body: 'not-an-object', status: 400, code: 'INVALID_BODY' },
];

let server: RunningServer;

function errorCode(response: HttpResponse<unknown>): string | undefined {
  return (response.body as ErrorBody | undefined)?.error?.code;
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

describe('small: user × route × method matrix', () => {
  for (const row of MATRIX) {
    const label = `${row.user ?? 'anonymous'} ${row.method} ${row.path} → ${row.status}${row.code === undefined ? '' : ` ${row.code}`}`;
    test(label, async () => {
      const response = await httpRequest({ baseUrl: server.baseUrl, path: `/api/small${row.path}`, method: row.method, userId: row.user, body: row.body });
      expect(response.status).toBe(row.status);
      if (row.code !== undefined) expect(errorCode(response)).toBe(row.code);
    });
  }
});

describe('small: find projections', () => {
  test('anonymous sees only id and title from the read-only name', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/small/notes/published' });
    expect(response.body.map((note) => Object.keys(note).sort())).toEqual([['id', 'title'], ['id', 'title']]);
  });

  test('member list without select returns all permitted fields and hides pinned', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/small/notes', userId: 'mia' });
    expect(Object.keys(response.body[0] ?? {}).sort()).toEqual(['author', 'body', 'id', 'title']);
  });

  test('select is trimmed to the permitted fields', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/small/notes?select=id,title,pinned', userId: 'mia' });
    expect(Object.keys(response.body[0] ?? {}).sort()).toEqual(['id', 'title']);
  });

  test('editor with * gets the full record', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/small/notes', userId: 'eli' });
    expect(Object.keys(response.body[0] ?? {}).sort()).toEqual(['author', 'body', 'id', 'pinned', 'title']);
  });

  test('editor select of a subset is honoured', async () => {
    const response = await httpRequest<readonly Record<string, unknown>[]>({ baseUrl: server.baseUrl, path: '/api/small/notes?select=id', userId: 'eli' });
    expect(response.body).toEqual([{ id: 'n1' }, { id: 'n2' }]);
  });
});

describe('small: write contract', () => {
  test('PROPERTIES_NOT_ALLOWED lists the rejected fields', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/small/notes/n2', method: 'PATCH', userId: 'mia', body: { title: 'x', pinned: true, author: 'me' } });
    expect(response.status).toBe(403);
    expect(response.body.error.fields).toEqual(['pinned', 'author']);
  });

  test('a denied write leaves the store untouched', async () => {
    await httpRequest({ baseUrl: server.baseUrl, path: '/api/small/notes/n2', method: 'PATCH', userId: 'mia', body: { title: 'x', pinned: true } });
    const after = await httpRequest<readonly { id: string; title: string }[]>({ baseUrl: server.baseUrl, path: '/api/small/notes', userId: 'mia' });
    expect(after.body.find((note) => note.id === 'n2')?.title).toBe('Retro');
  });

  test('synchronous module hook denies removing a pinned note with a stable reason', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/small/notes/n1', method: 'DELETE', userId: 'eli' });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [PINNED_NOTE_MESSAGE] } });
  });

  test('asynchronous module hook denies duplicate tag labels', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/small/tags', method: 'POST', userId: 'eli', body: { label: 'idea', color: 'blue' } });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [DUPLICATE_TAG_MESSAGE] } });
  });

  test('a successful create is visible on the next find', async () => {
    const created = await httpRequest<{ id: string }>({ baseUrl: server.baseUrl, path: '/api/small/notes', method: 'POST', userId: 'mia', body: NOTE_BODY });
    const list = await httpRequest<readonly { id: string; author: string }[]>({ baseUrl: server.baseUrl, path: '/api/small/notes', userId: 'mia' });
    expect(list.body.find((note) => note.id === created.body.id)?.author).toBe('mia');
  });
});

describe('small: identity is never read from the body', () => {
  test('role and permissions in the body do not lift a denial', async () => {
    const response = await httpRequest({ baseUrl: server.baseUrl, path: '/api/small/tags', method: 'POST', userId: 'noah', body: { ...TAG_BODY, role: 'editor', permissions: ['editor::small.tags::all'] } });
    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('role and permissions in the body are treated as data and rejected', async () => {
    const response = await httpRequest<ErrorBody>({ baseUrl: server.baseUrl, path: '/api/small/notes', method: 'POST', userId: 'mia', body: { ...NOTE_BODY, role: 'editor', permissions: [] } });
    expect(response.status).toBe(403);
    expect(response.body.error.fields).toEqual(['role', 'permissions']);
  });

  test('anonymous identity uses the fixed public list', async () => {
    const response = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/small/me' });
    expect(response.body).toEqual({
      user: 'anonymous',
      role: 'public',
      access: { 'public::small.notes::read-only': { find: true, update: false, create: false, remove: false } },
    });
  });

  test('a user with an empty list has an empty access map', async () => {
    const response = await httpRequest<MeResponse>({ baseUrl: server.baseUrl, path: '/api/small/me', userId: 'zed' });
    expect(response.body.access).toEqual({});
  });

  test('catalog is filtered to the small prefix and lists only assignable ids', async () => {
    const response = await httpRequest<Record<string, unknown>>({ baseUrl: server.baseUrl, path: '/api/small/catalog', userId: 'eli' });
    expect(Object.keys(response.body).sort()).toEqual([
      'editor::small.notes::all',
      'editor::small.profile::all',
      'editor::small.tags::all',
      'member::small.notes::all',
      'member::small.profile::all',
      'member::small.tags::all',
      'public::small.notes::read-only',
    ]);
  });
});
