import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { httpRequest, type HttpResponse } from '../../testing/httpRequest';
import { startTestServer, type RunningServer } from '../../testing/testServer';
import type { ErrorBody } from '../../server/errors';
import type { MeResponse } from '../../server/meRoute';
import { CLOSED_ORDER_MESSAGE, GRANT_SOURCES_PREFIX, LOCKED_STOCK_MESSAGE, NOT_ORDER_OWNER_MESSAGE } from '../server/permissions';
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

const ITEM_BODY = { sku: 'WASHER-10', name: 'Washer 10mm', price: 0.1, cost: 0.05 };
const STOCK_BODY = { itemId: 'i1', warehouse: 'east', quantity: 10 };
const ORDER_BODY = { customer: 'Umbrella', total: 10 };
const LINE_BODY = { orderId: 'o1', sku: 'BOLT-10', quantity: 1, price: 0.5 };
const INVOICE_BODY = { orderId: 'o3', amount: 75 };
const EMPLOYEE_BODY = { name: 'New Hire', title: 'Intern', salary: 1000 };
const SALES_ONLY_PERMISSIONS = { permissions: ['sales::large.sales.orders::update-only'] };

const MATRIX: readonly MatrixRow[] = [
  { user: undefined, method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: undefined, method: 'GET', path: '/sales/orders', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: '/me', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ghost', method: 'GET', path: '/inventory/items', status: 401, code: 'UNKNOWN_USER' },
  { user: 'ada', method: 'GET', path: '/me', status: 200 },
  { user: 'ada', method: 'GET', path: '/catalog', status: 200 },
  { user: 'ada', method: 'GET', path: '/hr/employees/accounts', status: 200 },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: SALES_ONLY_PERMISSIONS, status: 200 },
  { user: 'ada', method: 'PUT', path: '/users/ghost/permissions', body: SALES_ONLY_PERMISSIONS, status: 404, code: 'NOT_FOUND' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: { permissions: ['admin::large.sales.orders::all'] }, status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: { permissions: ['sales::large.sales.orders::nope'] }, status: 403, code: 'UNKNOWN_PERMISSION' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: { permissions: 'sales::large.sales.orders::all' }, status: 400, code: 'INVALID_BODY' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: { permissions: [1] }, status: 400, code: 'INVALID_BODY' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: {}, status: 400, code: 'INVALID_BODY' },
  { user: 'ada', method: 'PUT', path: '/users/sam/permissions', body: { ...SALES_ONLY_PERMISSIONS, role: 'admin' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'ada', method: 'GET', path: '/inventory/items', status: 200 },
  { user: 'ada', method: 'POST', path: '/inventory/items', body: ITEM_BODY, status: 201 },
  { user: 'ada', method: 'PATCH', path: '/inventory/items/i1', body: { name: 'Bolt' }, status: 200 },
  { user: 'ada', method: 'PATCH', path: '/inventory/items/i999', body: { name: 'Bolt' }, status: 404, code: 'NOT_FOUND' },
  { user: 'ada', method: 'DELETE', path: '/inventory/items/i2', status: 204 },
  { user: 'ada', method: 'GET', path: '/inventory/warehouses/stock', status: 200 },
  { user: 'ada', method: 'POST', path: '/inventory/warehouses/stock', body: STOCK_BODY, status: 201 },
  { user: 'ada', method: 'PATCH', path: '/inventory/warehouses/stock/s2', body: { quantity: 1 }, status: 200 },
  { user: 'ada', method: 'GET', path: '/sales/orders', status: 200 },
  { user: 'ada', method: 'POST', path: '/sales/orders', body: ORDER_BODY, status: 201 },
  { user: 'ada', method: 'PATCH', path: '/sales/orders/o3', body: { status: 'closed' }, status: 200 },
  { user: 'ada', method: 'PATCH', path: '/sales/orders/o1', body: { total: 1 }, status: 403, code: 'HOOK_ERROR' },
  { user: 'ada', method: 'DELETE', path: '/sales/orders/o1', status: 204 },
  { user: 'ada', method: 'GET', path: '/sales/orders/summary', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ada', method: 'GET', path: '/sales/orders/status', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'ada', method: 'GET', path: '/sales/orders/lines', status: 200 },
  { user: 'ada', method: 'GET', path: '/sales/orders/lines/sources', status: 200 },
  { user: 'ada', method: 'POST', path: '/sales/orders/lines', body: LINE_BODY, status: 201 },
  { user: 'ada', method: 'PATCH', path: '/sales/orders/lines/l1', body: { price: 0.7 }, status: 200 },
  { user: 'ada', method: 'DELETE', path: '/sales/orders/lines/l1', status: 204 },
  { user: 'ada', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'ada', method: 'POST', path: '/billing/invoices', body: INVOICE_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'ada', method: 'DELETE', path: '/billing/invoices/v1', status: 204 },
  { user: 'ada', method: 'GET', path: '/hr/employees', status: 200 },
  { user: 'ada', method: 'POST', path: '/hr/employees', body: EMPLOYEE_BODY, status: 201 },
  { user: 'ada', method: 'PATCH', path: '/hr/employees/e1', body: { title: 'CEO' }, status: 200 },
  { user: 'ada', method: 'DELETE', path: '/hr/employees/e3', status: 204 },
  { user: 'ada', method: 'POST', path: '/hr/employees', body: 'not-an-object', status: 400, code: 'INVALID_BODY' },
  { user: 'max', method: 'GET', path: '/me', status: 200 },
  { user: 'max', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'GET', path: '/hr/employees/accounts', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'PUT', path: '/users/sam/permissions', body: SALES_ONLY_PERMISSIONS, status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'GET', path: '/inventory/items', status: 200 },
  { user: 'max', method: 'PATCH', path: '/inventory/items/i1', body: { name: 'Bolt' }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'max', method: 'GET', path: '/inventory/warehouses/stock', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'GET', path: '/sales/orders', status: 200 },
  { user: 'max', method: 'PATCH', path: '/sales/orders/o1', body: { total: 1 }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'max', method: 'DELETE', path: '/sales/orders/o1', status: 204 },
  { user: 'max', method: 'GET', path: '/sales/orders/summary', status: 200 },
  { user: 'max', method: 'GET', path: '/sales/orders/status', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'GET', path: '/sales/orders/lines', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'max', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'max', method: 'GET', path: '/hr/employees', status: 200 },
  { user: 'max', method: 'POST', path: '/hr/employees', body: EMPLOYEE_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'meg', method: 'GET', path: '/inventory/items', status: 200 },
  { user: 'meg', method: 'GET', path: '/sales/orders', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'meg', method: 'GET', path: '/sales/orders/summary', status: 200 },
  { user: 'meg', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'wes', method: 'GET', path: '/inventory/items', status: 200 },
  { user: 'wes', method: 'PATCH', path: '/inventory/items/i1', body: { name: 'Bolt' }, status: 200 },
  { user: 'wes', method: 'PATCH', path: '/inventory/items/i1', body: { price: 1 }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'wes', method: 'GET', path: '/inventory/warehouses/stock', status: 200 },
  { user: 'wes', method: 'POST', path: '/inventory/warehouses/stock', body: STOCK_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'wes', method: 'PATCH', path: '/inventory/warehouses/stock/s1', body: { quantity: 5 }, status: 200 },
  { user: 'wes', method: 'PATCH', path: '/inventory/warehouses/stock/s2', body: { quantity: 5 }, status: 403, code: 'HOOK_ERROR' },
  { user: 'wes', method: 'PATCH', path: '/inventory/warehouses/stock/s999', body: { quantity: 5 }, status: 404, code: 'NOT_FOUND' },
  { user: 'wil', method: 'GET', path: '/inventory/warehouses/stock', status: 200 },
  { user: 'wil', method: 'PATCH', path: '/inventory/warehouses/stock/s2', body: { quantity: 5 }, status: 200 },
  { user: 'sam', method: 'GET', path: '/inventory/items', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'sam', method: 'GET', path: '/sales/orders', status: 200 },
  { user: 'sam', method: 'POST', path: '/sales/orders', body: ORDER_BODY, status: 201 },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/o1', body: { total: 300 }, status: 200 },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/o1', body: { status: 'closed' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/o2', body: { total: 1 }, status: 403, code: 'HOOK_ERROR' },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/o3', body: { total: 1 }, status: 403, code: 'HOOK_ERROR' },
  { user: 'sam', method: 'DELETE', path: '/sales/orders/o1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'sam', method: 'GET', path: '/sales/orders/summary', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'sam', method: 'GET', path: '/sales/orders/status', status: 200 },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/status/o1', body: { status: 'closed' }, status: 200 },
  { user: 'sam', method: 'PATCH', path: '/sales/orders/status/o2', body: { status: 'open' }, status: 403, code: 'HOOK_ERROR' },
  { user: 'sam', method: 'GET', path: '/sales/orders/lines', status: 200 },
  { user: 'sam', method: 'GET', path: '/sales/orders/lines/sources', status: 403, code: 'HOOK_ERROR' },
  { user: 'sam', method: 'POST', path: '/sales/orders/lines', body: LINE_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'sam', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'sam', method: 'POST', path: '/billing/invoices', body: INVOICE_BODY, status: 403, code: 'METHOD_DISABLED' },
  { user: 'sue', method: 'GET', path: '/sales/orders/lines', status: 200 },
  { user: 'sue', method: 'GET', path: '/sales/orders/lines/sources', status: 200 },
  { user: 'sue', method: 'POST', path: '/sales/orders/lines', body: LINE_BODY, status: 201 },
  { user: 'sue', method: 'PATCH', path: '/sales/orders/lines/l1', body: { quantity: 2 }, status: 200 },
  { user: 'sue', method: 'PATCH', path: '/sales/orders/lines/l1', body: { price: 2 }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'sue', method: 'DELETE', path: '/sales/orders/lines/l1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'sue', method: 'GET', path: '/sales/orders/status', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'sue', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'cat', method: 'GET', path: '/billing/invoices', status: 200 },
  { user: 'cat', method: 'POST', path: '/billing/invoices', body: INVOICE_BODY, status: 201 },
  { user: 'cat', method: 'PATCH', path: '/billing/invoices/v2', body: { status: 'sent' }, status: 200 },
  { user: 'cat', method: 'PATCH', path: '/billing/invoices/v2', body: { amount: 1 }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'cat', method: 'DELETE', path: '/billing/invoices/v2', status: 403, code: 'METHOD_DISABLED' },
  { user: 'cat', method: 'GET', path: '/sales/orders', status: 200 },
  { user: 'cat', method: 'PATCH', path: '/sales/orders/o1', body: { total: 1 }, status: 403, code: 'METHOD_DISABLED' },
  { user: 'cat', method: 'GET', path: '/sales/orders/summary', status: 200 },
  { user: 'cat', method: 'GET', path: '/sales/orders/lines', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'hal', method: 'GET', path: '/hr/employees', status: 200 },
  { user: 'hal', method: 'POST', path: '/hr/employees', body: EMPLOYEE_BODY, status: 201 },
  { user: 'hal', method: 'PATCH', path: '/hr/employees/e1', body: { salary: 9500 }, status: 200 },
  { user: 'hal', method: 'PATCH', path: '/hr/employees/e1', body: { name: 'Ada' }, status: 403, code: 'PROPERTIES_NOT_ALLOWED' },
  { user: 'hal', method: 'DELETE', path: '/hr/employees/e1', status: 403, code: 'METHOD_DISABLED' },
  { user: 'hal', method: 'GET', path: '/catalog', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'hal', method: 'GET', path: '/inventory/items', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'nil', method: 'GET', path: '/me', status: 200 },
  { user: 'nil', method: 'GET', path: '/sales/orders', status: 403, code: 'PERMISSION_NOT_ASSIGNED' },
  { user: 'rex', method: 'GET', path: '/me', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rex', method: 'GET', path: '/sales/orders', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
  { user: 'rex', method: 'GET', path: '/inventory/items', status: 403, code: 'PERMISSION_ROLE_MISMATCH' },
];

let server: RunningServer;

function errorCode(response: HttpResponse<unknown>): string | undefined {
  return (response.body as ErrorBody | undefined)?.error?.code;
}

function keysOfFirst(response: HttpResponse<readonly Record<string, unknown>[]>): readonly string[] {
  return Object.keys(response.body[0] ?? {}).sort();
}

function largeRequest<Body = unknown>(path: string, userId?: string, method?: Method, body?: unknown): Promise<HttpResponse<Body>> {
  return httpRequest<Body>({ baseUrl: server.baseUrl, path: `/api/large${path}`, userId, method, body });
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

describe('large: user × route × method matrix', () => {
  for (const row of MATRIX) {
    const label = `${row.user ?? 'no header'} ${row.method} ${row.path} → ${row.status}${row.code === undefined ? '' : ` ${row.code}`}`;
    test(label, async () => {
      const response = await largeRequest(row.path, row.user, row.method, row.body);
      expect(response.status).toBe(row.status);
      if (row.code !== undefined) expect(errorCode(response)).toBe(row.code);
    });
  }
});

describe('large: direct assignment versus grants', () => {
  test('manager reaching items only through the summary grant sees the grant fields', async () => {
    expect(keysOfFirst(await largeRequest('/inventory/items', 'max'))).toEqual(['id', 'name', 'sku']);
  });

  test('manager with items assigned directly gets the direct fields even though the grant exists', async () => {
    expect(keysOfFirst(await largeRequest('/inventory/items', 'meg'))).toEqual(['id', 'name', 'price', 'sku']);
  });

  test('two grants towards lines from two sales identifiers unite their fields', async () => {
    expect(keysOfFirst(await largeRequest('/sales/orders/lines', 'sam'))).toEqual(['id', 'orderId', 'price', 'quantity', 'sku']);
  });

  test('a direct lines assignment decides alone even when the grants are broader', async () => {
    expect(keysOfFirst(await largeRequest('/sales/orders/lines', 'sue'))).toEqual(['id', 'orderId', 'quantity', 'sku']);
  });

  test('the name+role hook receives grantedBy with both identifiers sorted', async () => {
    const response = await largeRequest<ErrorBody>('/sales/orders/lines/sources', 'sam');
    expect(response.body).toEqual({
      error: { code: 'HOOK_ERROR', reasons: [`${GRANT_SOURCES_PREFIX}sales::large.sales.orders::all, sales::large.sales.orders::update-only`] },
    });
  });

  test('the cycle orders ↔ invoices resolves each grant separately', async () => {
    expect(keysOfFirst(await largeRequest('/sales/orders', 'cat'))).toEqual(['customer', 'id', 'total']);
    expect(keysOfFirst(await largeRequest('/billing/invoices', 'sam'))).toEqual(['amount', 'id', 'orderId']);
  });

  test('grants are one hop: access received by grant does not enable another grant', async () => {
    const response = await largeRequest('/inventory/warehouses/stock', 'meg');
    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('select with fields outside the permitted ones is trimmed silently', async () => {
    expect(keysOfFirst(await largeRequest('/inventory/items?select=id,sku,cost,secret', 'wes'))).toEqual(['id', 'sku']);
  });

  test('find without select returns every permitted field', async () => {
    expect(keysOfFirst(await largeRequest('/inventory/warehouses/stock', 'wil'))).toEqual(['id', 'itemId', 'quantity', 'warehouse']);
    expect(keysOfFirst(await largeRequest('/inventory/warehouses/stock', 'ada'))).toEqual(['id', 'isLocked', 'itemId', 'quantity', 'warehouse']);
  });
});

describe('large: hooks', () => {
  test('module and name hooks fail together in registration order', async () => {
    const response = await largeRequest<ErrorBody>('/sales/orders/o2', 'sam', 'PATCH', { total: 1 });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [CLOSED_ORDER_MESSAGE, NOT_ORDER_OWNER_MESSAGE] } });
  });

  test('the ownership hook alone denies updating a foreign open order', async () => {
    const response = await largeRequest<ErrorBody>('/sales/orders/o3', 'sam', 'PATCH', { total: 1 });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [NOT_ORDER_OWNER_MESSAGE] } });
  });

  test('the module hook runs for update-only while the name hook of all does not', async () => {
    const response = await largeRequest<ErrorBody>('/sales/orders/status/o2', 'sam', 'PATCH', { status: 'open' });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [CLOSED_ORDER_MESSAGE] } });
  });

  test('the derived-only hook denies warehouse access obtained by grant on a locked warehouse', async () => {
    const response = await largeRequest<ErrorBody>('/inventory/warehouses/stock/s2', 'wes', 'PATCH', { quantity: 5 });
    expect(response.body).toEqual({ error: { code: 'HOOK_ERROR', reasons: [LOCKED_STOCK_MESSAGE] } });
  });

  test('a denied update leaves the store untouched', async () => {
    await largeRequest('/sales/orders/o2', 'sam', 'PATCH', { total: 1 });
    const orders = await largeRequest<readonly { id: string; total: number }[]>('/sales/orders', 'sam');
    expect(orders.body.find((order) => order.id === 'o2')?.total).toBe(900);
  });
});

describe('large: hot permission administration', () => {
  test('the next request of the user reflects the new list immediately', async () => {
    await largeRequest('/users/sam/permissions', 'ada', 'PUT', SALES_ONLY_PERMISSIONS);
    expect(keysOfFirst(await largeRequest('/sales/orders/lines', 'sam'))).toEqual(['id', 'price', 'sku']);
    const orders = await largeRequest('/sales/orders', 'sam');
    expect(errorCode(orders)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('removing the source of a grant removes derived access', async () => {
    await largeRequest('/users/sam/permissions', 'ada', 'PUT', SALES_ONLY_PERMISSIONS);
    const invoices = await largeRequest('/billing/invoices', 'sam');
    expect(invoices.status).toBe(403);
    expect(errorCode(invoices)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('removing the source of a grant keeps a direct assignment', async () => {
    await largeRequest('/users/sue/permissions', 'ada', 'PUT', { permissions: ['sales::large.sales.orders.lines::all'] });
    expect((await largeRequest('/sales/orders/lines', 'sue')).status).toBe(200);
    expect(errorCode(await largeRequest('/billing/invoices', 'sue'))).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('a row of another role is rejected and nothing is saved', async () => {
    const response = await largeRequest('/users/sam/permissions', 'ada', 'PUT', { permissions: ['sales::large.sales.orders::all', 'admin::large.sales.orders::all'] });
    expect(errorCode(response)).toBe('PERMISSION_ROLE_MISMATCH');
    expect((await largeRequest('/sales/orders/status', 'sam')).status).toBe(200);
  });

  test('an unknown identifier is rejected and nothing is saved', async () => {
    const response = await largeRequest('/users/sam/permissions', 'ada', 'PUT', { permissions: ['sales::large.sales.orders::all', 'sales::large.sales.orders::nope'] });
    expect(errorCode(response)).toBe('UNKNOWN_PERMISSION');
    expect((await largeRequest('/sales/orders/status', 'sam')).status).toBe(200);
  });

  test('repairing an injected row restores the user', async () => {
    await largeRequest('/users/rex/permissions', 'ada', 'PUT', { permissions: ['sales::large.sales.orders::all'] });
    const me = await largeRequest<MeResponse>('/me', 'rex');
    expect(me.status).toBe(200);
    expect(Object.keys(me.body.access).sort()).toEqual(['sales::large.billing.invoices::all', 'sales::large.sales.orders.lines::all', 'sales::large.sales.orders::all']);
  });

  test('the response echoes the saved identifier list', async () => {
    const response = await largeRequest<{ id: string; role: string; permissions: readonly string[] }>('/users/sam/permissions', 'ada', 'PUT', SALES_ONLY_PERMISSIONS);
    expect(response.body).toEqual({ id: 'sam', role: 'sales', permissions: SALES_ONLY_PERMISSIONS.permissions });
  });

  test('catalog lists only the assignable identifiers of the large prefix', async () => {
    const response = await largeRequest<Record<string, unknown>>('/catalog', 'ada');
    expect(Object.keys(response.body).sort()).toEqual([
      'accountant::large.billing.invoices::all',
      'accountant::large.sales.orders::summary',
      'admin::large.billing.invoices::all',
      'admin::large.hr.employees::accounts',
      'admin::large.hr.employees::all',
      'admin::large.inventory.items::all',
      'admin::large.inventory.warehouses.stock::all',
      'admin::large.sales.orders.lines::all',
      'admin::large.sales.orders::all',
      'hr::large.hr.employees::all',
      'manager::large.hr.employees::all',
      'manager::large.inventory.items::all',
      'manager::large.sales.orders::all',
      'manager::large.sales.orders::summary',
      'sales::large.sales.orders.lines::all',
      'sales::large.sales.orders::all',
      'sales::large.sales.orders::update-only',
      'warehouse::large.inventory.items::all',
      'warehouse::large.inventory.warehouses.stock::all',
    ]);
  });

  test('accounts lists every simulated user with role and identifiers', async () => {
    const response = await largeRequest<readonly { id: string; role: string; permissions: readonly string[] }[]>('/hr/employees/accounts', 'ada');
    expect(response.body.map((user) => user.id)).toEqual(['ada', 'max', 'meg', 'wes', 'wil', 'sam', 'sue', 'cat', 'hal', 'nil', 'rex']);
    expect(response.body.find((user) => user.id === 'nil')).toEqual({ id: 'nil', role: 'manager', permissions: [] });
  });
});

describe('large: identity is never read from the body', () => {
  test('role and permissions in the body do not lift a denial', async () => {
    const response = await largeRequest('/inventory/items', 'sam', 'POST', { ...ITEM_BODY, role: 'admin', permissions: ['admin::large.inventory.items::all'] });
    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('role and permissions in the body are treated as data and rejected', async () => {
    const response = await largeRequest<ErrorBody>('/sales/orders', 'sam', 'POST', { ...ORDER_BODY, role: 'admin', permissions: [] });
    expect(response.status).toBe(403);
    expect(response.body.error.fields).toEqual(['role', 'permissions']);
  });

  test('a user with an empty list has an empty access map', async () => {
    const response = await largeRequest<MeResponse>('/me', 'nil');
    expect(response.body.access).toEqual({});
  });

  test('the access map of a derived user lists direct and derived targets', async () => {
    const response = await largeRequest<MeResponse>('/me', 'sam');
    expect(response.body.access).toEqual({
      'sales::large.sales.orders::all': { find: true, update: true, create: true, remove: false },
      'sales::large.sales.orders::update-only': { find: true, update: true, create: false, remove: false },
      'sales::large.sales.orders.lines::all': { find: true, update: false, create: false, remove: false },
      'sales::large.billing.invoices::all': { find: true, update: false, create: false, remove: false },
    });
  });
});
