import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import { setTimeout as delay } from 'node:timers/promises';
import type { Context, Data, ResolvedPermission } from '../src/types';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, resetState, setupInventory } from './helpers';

const action = 'inventory.items';
const staffReports = { action, name: 'all', role: 'staff', permissions: [STAFF_REPORTS] } as const;
const adminReports = { action, name: 'all', role: 'admin', permissions: [ADMIN_REPORTS] } as const;
const staffItems = { action, name: 'all', role: 'staff', permissions: [STAFF_ITEMS_ALL] } as const;
const adminItems = { action, name: 'all', role: 'admin', permissions: [ADMIN_ITEMS_ALL] } as const;
const SOURCE = 'staff::source::all';
const OTHER = 'staff::other::all';
const targetRequest = { action: 'target', name: 'all', role: 'staff', method: 'find' } as const;

describe('validate', () => {
  beforeEach(resetState);

  describe('sealing', () => {
    test('returns NOT_SEALED before seal()', async () => {
      setupInventory();

      expect(await pkit.validate({ ...staffReports, method: 'find' })).toEqual({
        result: null, errors: [{ code: 'NOT_SEALED', message: expect.stringMatching(/pkit.seal\(\) has not been called/) }],
      });
    });
  });

  describe('denial order', () => {
    test('denies in order: input, role, assignments, module and name, assignment, method', async () => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', role: 'staff' } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'staff', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', role: 'nobody' as never }))).toEqual(['UNKNOWN_ROLE']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['staff::x'] }))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find', permissions: [ADMIN_REPORTS] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_REPORTS, 'staff::inventory.items::old'] }))).toEqual(['UNKNOWN_PERMISSION']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['admin::inventory.items::update-only'] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
      expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find' }))).toEqual(['UNKNOWN_ACTION']);
      expect(errorCodes(await pkit.validate({ ...staffReports, name: 'missing', method: 'find' }))).toEqual(['UNKNOWN_PERMISSION']);
      expect(errorCodes(await pkit.validate({ ...adminReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
      expect(errorCodes(await pkit.validate({ ...staffReports, name: 'update-only', method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
      expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', role: 'public', permissions: ['public::inventory.items::all'] }))).toEqual(['METHOD_DISABLED']);
    });
  });

  describe('grants', () => {
    test('grants exactly their fields without inheriting the direct wildcard', async () => {
      setupInventory();
      pkit.seal();

      expect(await pkit.validate({ ...adminReports, method: 'find' })).toEqual({ result: ['id', 'name', 'assetId'], errors: [] });
      expect((await pkit.validate({ ...adminReports, method: 'find', select: ['id', 'internalNotes'] })).result).toEqual(['id']);
      expect((await pkit.validate({ ...adminReports, name: 'update-only', method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
      expect((await pkit.validate({ ...staffReports, method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
    });

    test('prefers the direct assignment over a grant even when narrower', async () => {
      setupInventory();
      pkit.seal();

      expect((await pkit.validate({ ...adminReports, method: 'find', permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] })).result).toBe('*');

      resetState();
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
      pkit.seal();

      expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id', 'name']);
      expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE, 'staff::target::all'] })).result).toEqual(['id']);
    });

    test('unites fields from several grants and runs hooks once', async () => {
      const { target, source, other } = setupGraph();
      const executedHooks: string[] = [];
      const capturedPermissions: ResolvedPermission[] = [];

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      other.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(OTHER).registerActions({ find: { enabled: true, properties: ['name', 'extra'] } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
      target.hook('find', recordHook.bind(null, executedHooks, 'name'));
      target.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
      target.role('staff').hook('find', capturePermission.bind(null, capturedPermissions));
      pkit.seal();

      const validation = await pkit.validate({ ...targetRequest, permissions: [OTHER, SOURCE] });

      expect(validation).toEqual({ result: ['name', 'extra', 'id'], errors: [] });
      expect(executedHooks).toEqual(['name', 'staff']);
      expect(capturedPermissions[0]?.authorization).toEqual({ direct: false, grantedBy: [OTHER, SOURCE] });
    });

    test('enables only declared methods per grant and direct assignment', async () => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffReports, name: 'update-only', method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);

      const data = { id: 1, name: 'Item' };
      const validation = await pkit.validate({ action, name: 'update-only', method: 'update', role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY], data });

      expect(validation).toEqual({ result: data, errors: [] });
    });

    test('keeps different names independent', async () => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffItems, name: 'update-only', method: 'find' }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'find', permissions: [STAFF_ITEMS_UPDATE_ONLY] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('denies an empty list and deduplicates repeated identifiers', async () => {
      const { itemsAll } = setupInventory();
      const executedHooks: string[] = [];

      itemsAll.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);

      const validation = await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_REPORTS, STAFF_REPORTS] });

      expect(validation.result).toEqual(['id', 'name', 'assetId']);
      expect(executedHooks).toEqual(['staff']);
    });

    test('prefers a disabled direct assignment over a grant; unassigned definitions do not participate', async () => {
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: false, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...targetRequest, permissions: [SOURCE, 'staff::target::all'] }))).toEqual(['METHOD_DISABLED']);
      expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id']);
    });

    test('grants from a source whose methods are all disabled', async () => {
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: false, properties: [] } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
      pkit.seal();

      expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id']);
      expect(errorCodes(await pkit.validate({ ...targetRequest, action: 'source', permissions: [SOURCE] }))).toEqual(['METHOD_DISABLED']);
    });

    test('stops grants at one hop', async () => {
      const { target, source, other } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      other.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
      source.grantTo(OTHER).registerActions({ find: { enabled: true, properties: ['id'] } });
      pkit.seal();

      expect((await pkit.validate({ ...targetRequest, action: 'source', permissions: [OTHER] })).result).toEqual(['id']);
      expect(errorCodes(await pkit.validate({ ...targetRequest, permissions: [OTHER] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });
  });

  describe('hooks', () => {
    test('runs hooks module, name, effective role for direct and derived access only', async () => {
      const { items, itemsAll, itemsUpdateOnly, reports } = setupInventory();
      const executedHooks: string[] = [];

      items.hook('find', recordHook.bind(null, executedHooks, 'module'));
      itemsAll.hook('find', recordHook.bind(null, executedHooks, 'name'));
      itemsAll.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
      itemsAll.role('admin').hook('find', recordHook.bind(null, executedHooks, 'admin'));
      itemsUpdateOnly.hook('find', recordHook.bind(null, executedHooks, 'update-only'));
      reports.hook('find', recordHook.bind(null, executedHooks, 'reports'));
      reports.role('staff').hook('find', recordHook.bind(null, executedHooks, 'reports:staff'));
      items.hook('update', checkPublication.bind(null, executedHooks));
      itemsAll.role('staff').hook('update', checkOwner.bind(null, executedHooks));
      pkit.seal();

      expect((await pkit.validate({ ...staffReports, method: 'find' })).errors).toEqual([]);
      expect(executedHooks).toEqual(['module', 'name', 'staff']);

      executedHooks.length = 0;

      expect((await pkit.validate({ ...adminItems, method: 'find' })).errors).toEqual([]);
      expect(executedHooks).toEqual(['module', 'name', 'admin']);

      executedHooks.length = 0;

      const adminUpdate = await pkit.validate({ ...adminItems, method: 'update', data: { status: 'published', owner: 2 }, context: { user: { id: 1 } } });

      expect(executedHooks).toEqual(['module']);
      expect(adminUpdate.errors).toEqual([{ code: 'HOOK_ERROR', message: 'published', cause: expect.any(Error) }]);

      executedHooks.length = 0;

      const staffUpdate = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x' }, context: { user: { id: 1 }, resource: { owner: 2 } } });

      expect(executedHooks).toEqual(['module', 'staff']);
      expect(staffUpdate.errors).toEqual([{ code: 'HOOK_ERROR', message: 'not owner', cause: expect.any(Error) }]);
    });

    test('passes the effective target and authorization source to hooks', async () => {
      const { itemsAll } = setupInventory();
      const capturedPermissions: ResolvedPermission[] = [];

      itemsAll.role('staff').hook('find', capturePermission.bind(null, capturedPermissions));
      pkit.seal();

      await pkit.validate({ ...staffReports, method: 'find' });
      await pkit.validate({ ...staffItems, method: 'find', permissions: [STAFF_ITEMS_ALL, STAFF_REPORTS] });

      expect(capturedPermissions[0]).toEqual({
        role: 'staff',
        action,
        name: 'all',
        permissionId: STAFF_ITEMS_ALL,
        method: 'find',
        enabled: true,
        properties: ['id', 'name', 'assetId'],
        authorization: { direct: false, grantedBy: [STAFF_REPORTS] },
      });
      expect(capturedPermissions[1]?.authorization).toEqual({ direct: true, grantedBy: [] });
      expect(Object.isFrozen(capturedPermissions[0])).toBe(true);
      expect(Object.isFrozen(capturedPermissions[0]?.authorization)).toBe(true);
      expect(Object.isFrozen(capturedPermissions[0]?.authorization.grantedBy)).toBe(true);
    });

    test('keeps all concurrent hook failures in registration order', async () => {
      const { items, itemsAll } = setupInventory();
      const firstFailure = new Error('first failure');
      const laterFailure = { reason: 'later failure' };
      const completionOrder: string[] = [];

      items.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'first', cause: firstFailure, delay: 10 }));
      itemsAll.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'second', cause: 'second failure', delay: 0 }));
      itemsAll.role('staff').hook('find', failRecordedHook.bind(null, completionOrder, { label: 'staff', cause: laterFailure, delay: 0 }));
      pkit.seal();

      const validation = await pkit.validate({ ...staffReports, method: 'find' });

      expect(completionOrder).toEqual(['second', 'staff', 'first']);
      expect(validation).toEqual({ result: null, errors: [
        { code: 'HOOK_ERROR', message: 'first failure', cause: firstFailure },
        { code: 'HOOK_ERROR', message: 'second failure', cause: 'second failure' },
        { code: 'HOOK_ERROR', message: '[object Object]', cause: laterFailure },
      ] });
      expect(Object.isFrozen(validation.errors)).toBe(true);
    });

    test('skips hooks when fields are denied', async () => {
      const { items } = setupInventory();
      const executedHooks: string[] = [];

      items.hook('update', recordHook.bind(null, executedHooks, 'update'));
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'update', data: { owner: 1 } }))).toEqual(['PROPERTIES_NOT_ALLOWED']);
      expect(executedHooks).toEqual([]);
    });

    test('passes missing optional arguments to hooks without substitution', async () => {
      const { items } = setupInventory();

      items.hook('find', expectMissingArguments);
      pkit.seal();

      expect((await pkit.validate({ ...staffReports, method: 'find' })).errors).toEqual([]);
    });

    test('continues after a synchronous hook failure', async () => {
      const { items } = setupInventory();
      const executedHooks: string[] = [];

      items.hook('find', throwHookFailure.bind(null, 'synchronous failure'));
      items.hook('find', recordHook.bind(null, executedHooks, 'next'));
      pkit.seal();

      expect(await pkit.validate({ ...staffReports, method: 'find' })).toEqual({
        result: null, errors: [{ code: 'HOOK_ERROR', message: 'synchronous failure', cause: 'synchronous failure' }],
      });
      expect(executedHooks).toEqual(['next']);
    });
  });

  describe('field selection', () => {
    test('trims select to properties and defaults select to properties on find', async () => {
      setupInventory();
      pkit.seal();

      expect(await pkit.validate({ ...staffItems, method: 'find', select: ['id', 'owner'] })).toEqual({ result: ['id'], errors: [] });
      expect((await pkit.validate({ ...staffItems, method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
    });

    test("returns select or '*' when find properties are '*'", async () => {
      setupInventory();
      pkit.seal();

      expect((await pkit.validate({ ...adminItems, method: 'find' })).result).toBe('*');
      expect((await pkit.validate({ ...adminItems, method: 'find', select: ['owner'] })).result).toEqual(['owner']);
    });

    test('denies writes with fields outside properties and lists them', async () => {
      setupInventory();
      pkit.seal();

      const validation = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x', owner: 2, status: 'draft' } });

      expect(validation.result).toBeNull();
      expect(validation.errors).toEqual([
        { code: 'PROPERTIES_NOT_ALLOWED', message: expect.stringMatching(/owner, status$/), fields: ['owner', 'status'] },
      ]);
    });

    test('returns typed data on valid writes and accepts any field with *', async () => {
      setupInventory();
      pkit.seal();

      const data = { id: 1, name: 'x' };
      const validation = await pkit.validate({ ...staffItems, method: 'update', data });

      expect(validation.result).toBe(data);
      expect(validation.result?.id).toBe(1);
      expect((await pkit.validate({ ...adminItems, method: 'update', data: { owner: 9 } })).errors).toEqual([]);
    });

    test('reads request data once for fields, hooks and result', async () => {
      setupInventory();
      pkit.seal();

      const data = { id: 1 };
      const reads: number[] = [];
      const input = { ...staffItems, method: 'update' as const, data };

      Object.defineProperty(input, 'data', { get: readRecordedData.bind(null, reads, data) });

      expect(await pkit.validate(input)).toEqual({ result: data, errors: [] });
      expect(reads).toEqual([1]);
    });
  });

  describe('input validation', () => {
    test('rejects select outside find as a programming error', async () => {
      setupInventory();
      pkit.seal();

      expect(await pkit.validate({ ...adminItems, method: 'update', select: ['id'] } as never)).toEqual({
        result: null, errors: [{ code: 'INVALID_INPUT', message: 'select only applies to find' }],
      });
    });

    test.each([{ data: null }, { data: false }, { data: 1 }, { data: 'invalid' }, { data: [] }])('rejects invalid data %j even with wildcard properties', async ({ data }: { data: unknown }) => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...adminItems, method: 'update', data } as never))).toEqual(['INVALID_INPUT']);
    });

    test.each([{ context: null }, { context: false }, { context: 1 }, { context: 'invalid' }, { context: [] }])('rejects invalid context %j instead of substituting an empty object', async ({ context }: { context: unknown }) => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...adminItems, method: 'find', context } as never))).toEqual(['INVALID_INPUT']);
    });

    test.each([{ select: null }, { select: 'id' }, { select: [1] }])('rejects invalid select %j without skipping field evaluation', async ({ select }: { select: unknown }) => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...adminItems, method: 'find', select } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'find', select } as never))).toEqual(['INVALID_INPUT']);
    });

    test('rejects writes without data instead of fabricating an empty object', async () => {
      setupInventory();
      pkit.seal();

      expect(await pkit.validate({ ...adminItems, method: 'update' } as never)).toEqual({
        result: null, errors: [{ code: 'INVALID_INPUT', message: 'data must be an object' }],
      });
    });

    test('keeps the cause of unexpected failures inside validate', async () => {
      setupInventory();
      pkit.seal();

      const failure = new Error('broken request data');
      const input = Object.defineProperty({ ...staffItems, method: 'find' as const }, 'data', { get: throwHookFailure.bind(null, failure) });

      expect(await pkit.validate(input)).toEqual({ result: null, errors: [
        { code: 'VALIDATION_ERROR', message: 'permission could not be validated', cause: failure },
      ] });
    });
  });
});

function errorCodes(validation: { errors: readonly { code: string }[] }): string[] {
  const codes: string[] = [];

  for (const error of validation.errors) codes.push(error.code);

  return codes;
}

function setupGraph() {
  pkit.context.set('roles', ['staff']);

  return {
    target: pkit.module('target').name('all'),
    source: pkit.module('source').name('all'),
    other: pkit.module('other').name('all'),
  };
}

function recordHook(executedHooks: string[], label: string): void {
  executedHooks.push(label);
}

function capturePermission(permissions: ResolvedPermission[], _data: Data | undefined, _context: Context | undefined, permission: ResolvedPermission): void {
  permissions.push(permission);
}

function throwHookFailure(cause: unknown): never {
  throw cause;
}

function checkPublication(executedHooks: string[], data: Data | undefined): void {
  executedHooks.push('module');
  if (data!.status === 'published') throw new Error('published');
}

function checkOwner(executedHooks: string[], data: Data | undefined, context: Context | undefined): void {
  executedHooks.push('staff');
  if (data!.owner !== (context!.user as { id: number }).id) throw new Error('not owner');
}

async function failRecordedHook(completionOrder: string[], failure: { label: string; cause: unknown; delay: number }): Promise<never> {
  if (failure.delay > 0) await delay(failure.delay);
  completionOrder.push(failure.label);

  throw failure.cause;
}

function expectMissingArguments(data: Data | undefined, context: Context | undefined): void {
  expect(data).toBeUndefined();
  expect(context).toBeUndefined();
}

function readRecordedData(reads: number[], data: Data): Data {
  reads.push(1);

  return data;
}
