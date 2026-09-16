import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import { setTimeout as delay } from 'node:timers/promises';
import type { Context, Data, ValidationError } from '../src/types';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, resetState, setupInventory } from './helpers';

const action = 'inventory.items';
const staffReports = { action, role: 'staff', permissions: [STAFF_REPORTS] } as const;
const adminReports = { action, role: 'admin', permissions: [ADMIN_REPORTS] } as const;
const staffItems = { action, role: 'staff', permissions: [STAFF_ITEMS_ALL] } as const;
const adminItems = { action, role: 'admin', permissions: [ADMIN_ITEMS_ALL] } as const;
const SOURCE = 'staff::source::all';
const OTHER = 'staff::other::all';
const targetRequest = { action: 'target', role: 'staff', method: 'find' } as const;

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
    test('denies in order: input, role, assignments, module, name, assignment, method', async () => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ action, method: 'find', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'staff' } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ method: 'find', role: 'staff', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', role: 'nobody' as never }))).toEqual(['UNKNOWN_ROLE']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['staff::x'] }))).toEqual(['INVALID_INPUT']);
      expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find', permissions: [ADMIN_REPORTS] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_REPORTS, 'staff::inventory.items::old'] }))).toEqual(['UNKNOWN_PERMISSION']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['admin::inventory.items::update-only'] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
      expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find' }))).toEqual(['UNKNOWN_ACTION']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY] }))).toEqual(['AMBIGUOUS_PERMISSION']);
      expect(errorCodes(await pkit.validate({ ...adminReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
      expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'public', permissions: ['public::inventory.items::all'] }))).toEqual(['METHOD_DISABLED']);
    });
  });

  describe('grants', () => {
    test('grants exactly their fields without inheriting the direct wildcard', async () => {
      setupInventory();
      pkit.seal();

      const data = { id: 1, name: 'x', assetId: 'a' };

      expect(await pkit.validate({ ...adminReports, method: 'find', data })).toEqual({ result: { data }, errors: [] });
      expect(errorFields(await pkit.validate({ ...adminReports, method: 'find', data: { id: 1, internalNotes: 'x' } }))).toEqual(['internalNotes']);
      expect((await pkit.validate({ ...adminReports, method: 'find', data: { assetId: 'a' } })).errors).toEqual([]);
      expect((await pkit.validate({ ...staffReports, method: 'find', data })).errors).toEqual([]);
    });

    test('prefers the direct assignment over a grant even when narrower', async () => {
      setupInventory();
      pkit.seal();

      expect((await pkit.validate({ ...adminReports, method: 'find', data: { internalNotes: 'x' }, permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] })).errors).toEqual([]);

      resetState();
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
      pkit.seal();

      expect((await pkit.validate({ ...targetRequest, data: { id: 1, name: 'x' }, permissions: [SOURCE] })).errors).toEqual([]);
      expect(errorFields(await pkit.validate({ ...targetRequest, data: { id: 1, name: 'x' }, permissions: [SOURCE, 'staff::target::all'] }))).toEqual(['name']);
    });

    test('unites fields from several grants and runs hooks once', async () => {
      const { target, source, other } = setupGraph();
      const executedHooks: string[] = [];
      const capturedPermissions: (readonly string[])[] = [];

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      other.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(OTHER).registerActions({ find: { enabled: true, properties: ['name', 'extra'] } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
      target.hook('find', recordHook.bind(null, executedHooks, 'name'));
      target.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
      target.role('staff').hook('find', capturePermissions.bind(null, capturedPermissions));
      pkit.seal();

      const data = { name: 'x', extra: true, id: 1 };
      const validation = await pkit.validate({ ...targetRequest, data, permissions: [OTHER, SOURCE] });

      expect(validation).toEqual({ result: { data }, errors: [] });
      expect(executedHooks).toEqual(['name', 'staff']);
      expect(capturedPermissions[0]).toEqual([OTHER, SOURCE]);
      expect(errorFields(await pkit.validate({ ...targetRequest, data: { other: 1 }, permissions: [OTHER, SOURCE] }))).toEqual(['other']);
    });

    test('enables only declared methods per grant and direct assignment', async () => {
      setupInventory();
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);

      const data = { id: 1, name: 'Item' };
      const validation = await pkit.validate({ action, method: 'update', role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY], data });

      expect(validation).toEqual({ result: { data }, errors: [] });
    });

    test('keeps different names independent', async () => {
      setupInventory();
      pkit.seal();

      const updateOnly = { action, role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY] } as const;

      expect((await pkit.validate({ ...updateOnly, method: 'update', data: { assetId: 'a' } })).errors).toEqual([]);
      expect(errorFields(await pkit.validate({ ...staffItems, method: 'update', data: { assetId: 'a' } }))).toEqual(['assetId']);
    });

    test('denies an empty list and deduplicates repeated identifiers', async () => {
      const { itemsAll } = setupInventory();
      const executedHooks: string[] = [];

      itemsAll.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);

      const validation = await pkit.validate({ ...staffReports, method: 'find', data: { id: 1, name: 'x', assetId: 'a' }, permissions: [STAFF_REPORTS, STAFF_REPORTS] });

      expect(validation.errors).toEqual([]);
      expect(executedHooks).toEqual(['staff']);
    });

    test('prefers a disabled direct assignment over a grant; unassigned definitions do not participate', async () => {
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: false, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...targetRequest, permissions: [SOURCE, 'staff::target::all'] }))).toEqual(['METHOD_DISABLED']);
      expect((await pkit.validate({ ...targetRequest, data: { id: 1 }, permissions: [SOURCE] })).errors).toEqual([]);
    });

    test('grants from a source whose methods are all disabled', async () => {
      const { target, source } = setupGraph();

      target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
      source.role('staff').registerActions({ find: { enabled: false, properties: [] } });
      target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
      pkit.seal();

      expect((await pkit.validate({ ...targetRequest, data: { id: 1 }, permissions: [SOURCE] })).errors).toEqual([]);
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

      expect((await pkit.validate({ ...targetRequest, action: 'source', data: { id: 1 }, permissions: [OTHER] })).errors).toEqual([]);
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

      const staffUpdate = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x' }, context: { user: { id: 1 }, owner: 2 } });

      expect(executedHooks).toEqual(['module', 'staff']);
      expect(staffUpdate.errors).toEqual([{ code: 'HOOK_ERROR', message: 'not owner', cause: expect.any(Error) }]);
    });

    test('passes the user permissions to hooks without resolving them', async () => {
      const { itemsAll } = setupInventory();
      const capturedPermissions: (readonly string[])[] = [];

      itemsAll.role('staff').hook('find', capturePermissions.bind(null, capturedPermissions));
      pkit.seal();

      await pkit.validate({ ...staffReports, method: 'find' });
      await pkit.validate({ ...staffItems, method: 'find', permissions: [STAFF_ITEMS_ALL, STAFF_REPORTS] });

      expect(capturedPermissions[0]).toEqual([STAFF_REPORTS]);
      expect(capturedPermissions[1]).toEqual([STAFF_ITEMS_ALL, STAFF_REPORTS]);
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

    test('skips hooks when data keys are denied', async () => {
      const { items } = setupInventory();
      const executedHooks: string[] = [];

      items.hook('update', recordHook.bind(null, executedHooks, 'update'));
      pkit.seal();

      expect(errorCodes(await pkit.validate({ ...staffItems, method: 'update', data: { owner: 1 } }))).toEqual(['PROPERTIES_NOT_ALLOWED']);
      expect(executedHooks).toEqual([]);
    });

    test('substitutes missing data and context with empty objects before the hooks', async () => {
      const { items } = setupInventory();

      items.hook('find', expectEmptyArguments);
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

  describe('data properties', () => {
    test('accepts a subset of the permission properties on every method', async () => {
      setupInventory();
      pkit.seal();

      expect((await pkit.validate({ ...staffItems, method: 'find', data: { id: 1 } })).errors).toEqual([]);
      expect((await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x' } })).errors).toEqual([]);
      expect((await pkit.validate({ ...adminItems, method: 'create', data: { name: 'x', link: 'y' } })).errors).toEqual([]);
      expect((await pkit.validate({ ...adminItems, method: 'remove', data: { id: 1 } })).errors).toEqual([]);
    });

    test('denies data keys outside the permission and lists them', async () => {
      setupInventory();
      pkit.seal();

      const validation = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x', owner: 2, status: 'draft' } });

      expect(validation.result).toBeNull();
      expect(validation.errors).toEqual([
        { code: 'PROPERTIES_NOT_ALLOWED', message: 'fields not allowed: owner, status', fields: ['owner', 'status'] },
      ]);
      expect(errorFields(await pkit.validate({ ...staffItems, method: 'find', data: { owner: 2 } }))).toEqual(['owner']);
    });

    test('reports escaped dots and keys carrying undefined', async () => {
      setupInventory();
      pkit.seal();

      expect(errorFields(await pkit.validate({ ...staffItems, method: 'update', data: { 'a.b': 1 } }))).toEqual(['a.b']);
      expect(errorFields(await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, owner: undefined } }))).toEqual(['owner']);
    });

    test('accepts empty data and any field with *', async () => {
      setupInventory();
      pkit.seal();

      expect((await pkit.validate({ ...staffItems, method: 'find' })).errors).toEqual([]);
      expect((await pkit.validate({ ...staffItems, method: 'update', data: {} })).errors).toEqual([]);
      expect((await pkit.validate({ ...adminItems, method: 'update', data: { owner: 9, anything: true } })).errors).toEqual([]);
    });

    test('returns the same data object when nothing is cropped', async () => {
      setupInventory();
      pkit.seal();

      const data = { id: 1, name: 'x' };
      const validation = await pkit.validate({ ...staffItems, method: 'update', data });

      expect(validation.result?.data).toBe(data);
    });

    test('defaults data to an empty object on every method', async () => {
      setupInventory();
      pkit.seal();

      expect(await pkit.validate({ ...adminItems, method: 'update' })).toEqual({ result: { data: {} }, errors: [] });
      expect(await pkit.validate({ ...staffItems, method: 'find' })).toEqual({ result: { data: {} }, errors: [] });
    });

    test('reads request data once for the hooks and the result', async () => {
      setupInventory();
      pkit.seal();

      const data = { id: 1 };
      const reads: number[] = [];
      const input = { ...staffItems, method: 'update' as const, data };

      Object.defineProperty(input, 'data', { get: readRecordedData.bind(null, reads, data) });

      expect(await pkit.validate(input)).toEqual({ result: { data }, errors: [] });
      expect(reads).toEqual([1]);
    });
  });

  describe('cropper', () => {
    test('crops data to the properties of the permission', async () => {
      setupInventory();
      pkit.context.set('cropper', true);
      pkit.seal();

      const data = { id: 1, name: 'x', owner: 2, missing: undefined };
      const validation = await pkit.validate({ ...staffItems, method: 'update', data });

      expect(validation).toEqual({ result: { data: { id: 1, name: 'x' } }, errors: [] });
      expect(validation.result?.data).not.toBe(data);
    });

    test('never denies data keys outside the permission', async () => {
      setupInventory();
      pkit.context.set('cropper', true);
      pkit.seal();

      expect(await pkit.validate({ ...staffItems, method: 'find', data: { owner: 2 } })).toEqual({ result: { data: {} }, errors: [] });
    });

    test('leaves data untouched with *', async () => {
      setupInventory();
      pkit.context.set('cropper', true);
      pkit.seal();

      const data = { name: { first: 'x', tags: ['a'] }, owner: 2 };

      expect((await pkit.validate({ ...adminItems, method: 'update', data })).result?.data).toBe(data);
    });

    test('passes the cropped data to the hooks', async () => {
      const { items } = setupInventory();
      const capturedData: Data[] = [];

      items.hook('update', captureData.bind(null, capturedData));
      pkit.context.set('cropper', true);
      pkit.seal();

      await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, owner: 2 } });

      expect(capturedData[0]).toEqual({ id: 1 });
    });

    test('is frozen by seal() and rejects a non boolean', () => {
      setupInventory();

      expect(pkit.context.get('cropper')).toBe(false);
      pkit.context.set('cropper', true);
      expect(pkit.context.get('cropper')).toBe(true);
      expect(pkit.context.set.bind(null, 'cropper', 'yes' as never)).toThrow(/cropper must be a boolean/);

      pkit.seal();

      expect(pkit.context.set.bind(null, 'cropper', false)).toThrow(/pkit.seal\(\) was already called/);
      expect(pkit.context.get.bind(null, 'sorter' as never)).toThrow(/unknown context key/);
    });
  });

  describe('reservedFields', () => {
    test('allows reserved paths without denying them', async () => {
      setupNested(['name'], false, ['id', 'meta.version']);

      const allowedData = { id: 1, name: 'x', meta: { version: 2 } };

      const forbiddenData = { id: 1, meta: { version: 2, owner: 3 }, user: { id: 4 } };

      expect((await validateNested(allowedData)).result?.data).toBe(allowedData);

      expect(errorFields(await validateNested(forbiddenData))).toEqual(['meta.owner', 'user.id']);
    });

    test('keeps reserved paths when cropping', async () => {
      setupNested(['name'], true, ['id', 'items.id']);

      const data = { id: 1, name: 'x', owner: 2, items: [{ id: 3, secret: 4 }] };

      const validation = await validateNested(data);

      expect(validation).toEqual({ result: { data: { id: 1, name: 'x', items: [{ id: 3 }] } }, errors: [] });
    });

    test('defaults to empty, replaces on set and is frozen by seal()', () => {
      setupInventory();

      expect(pkit.context.get('reservedFields')).toEqual([]);

      pkit.context.set('reservedFields', ['id']);
      pkit.context.set('reservedFields', ['name', 'name']);

      expect(pkit.context.get('reservedFields')).toEqual(['name', 'name']);

      pkit.seal();

      expect(pkit.context.set.bind(null, 'reservedFields', [])).toThrow(/pkit.seal\(\) was already called/);
    });

    test('rejects invalid paths at set', () => {
      resetState();

      expect(pkit.context.set.bind(null, 'reservedFields', 'id' as never)).toThrow(/reservedFields must be an array of property paths/);
      expect(pkit.context.set.bind(null, 'reservedFields', [1] as never)).toThrow(/reservedFields must be an array of property paths/);
      expect(pkit.context.set.bind(null, 'reservedFields', ['*'])).toThrow(/cannot start with "\*"/);
      expect(pkit.context.set.bind(null, 'reservedFields', ['*.id'])).toThrow(/cannot start with "\*"/);
      expect(pkit.context.set.bind(null, 'reservedFields', ['items[0].id'])).toThrow(/array indexes are not allowed/);
      expect(pkit.context.set.bind(null, 'reservedFields', ['meta..id'])).toThrow(/empty segment/);
      expect(pkit.context.set.bind(null, 'reservedFields', [''])).toThrow(/empty segment/);
      expect(pkit.context.get('reservedFields')).toEqual([]);
    });
  });

  describe('nested properties', () => {
    test('matches literal paths and denies anything else under them', async () => {
      setupNested(['unicorn.name']);

      expect((await validateNested({ unicorn: { name: 'Rainbow Dash' } })).errors).toEqual([]);
      expect(errorFields(await validateNested({ unicorn: { name: 'x', color: 'y' } }))).toEqual(['unicorn.color']);
    });

    test('matches exactly one segment per wildcard', async () => {
      setupNested(['unicorn.*']);

      expect((await validateNested({ unicorn: { name: 'x', color: 'y' } })).errors).toEqual([]);
      expect(errorFields(await validateNested({ unicorn: { treasures: [{ id: 1 }] } }))).toEqual(['unicorn.treasures.id']);

      resetState();
      setupNested(['unicorn.treasures.*']);

      expect((await validateNested({ unicorn: { treasures: [{ id: 1, secret: 's' }, { id: 2 }] } })).errors).toEqual([]);

      resetState();
      setupNested(['unicorn.treasures.id']);

      expect(errorFields(await validateNested({ unicorn: { treasures: [{ id: 1, secret: 's' }, { id: 2, secret: 't' }] } }))).toEqual(['unicorn.treasures.secret']);
    });

    test('matches a wildcard segment against an empty container', async () => {
      setupNested(['unicorn.*']);

      expect((await validateNested({ unicorn: { name: 'x' } })).errors).toEqual([]);
      expect((await validateNested({ unicorn: { treasures: {} } })).errors).toEqual([]);
      expect(errorFields(await validateNested({ secret: { name: 'x' } }))).toEqual(['secret.name']);
    });

    test('treats a literal path as the exact leaf, not as a prefix', async () => {
      setupNested(['unicorn']);

      expect((await validateNested({ unicorn: {} })).errors).toEqual([]);
      expect((await validateNested({ unicorn: [] })).errors).toEqual([]);
      expect(errorFields(await validateNested({ unicorn: { name: 'x' } }))).toEqual(['unicorn.name']);
    });

    test('drops array indexes, including nested arrays', async () => {
      setupNested(['tags', 'matrix', 'unicorn.treasures.id']);

      expect((await validateNested({ tags: ['a', 'b'] })).errors).toEqual([]);
      expect((await validateNested({ matrix: [[1, 2], [3]] })).errors).toEqual([]);
      expect((await validateNested({ unicorn: { treasures: [{ id: 1 }, { id: 2 }] } })).errors).toEqual([]);
      expect(errorFields(await validateNested({ tags: [{ label: 'a' }] }))).toEqual(['tags.label']);
    });

    test('rejects array indexes, empty segments and a leading wildcard in the declared properties', () => {
      setupInventory();
      const fresh = pkit.module('inventory').name('fresh').role('staff');

      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties: ['treasures[0]'] } })).toThrow(/array indexes are not allowed/);
      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties: ['unicorn..name'] } })).toThrow(/empty segment/);
      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties: ['unicorn.'] } })).toThrow(/empty segment/);
      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties: ['*.name'] } })).toThrow(/cannot start with/);
      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties: ['*.*'] } })).toThrow(/cannot start with/);
    });

    test('crops nested paths, compacts arrays and prunes what it empties', async () => {
      setupNested(['id', 'unicorn.treasures.id'], true);

      const data = { id: 7, secret: 's', unicorn: { color: 'c', treasures: [{ id: 1, secret: 's' }, { secret: 't' }] } };
      const validation = await validateNested(data);

      expect(validation.result?.data).toEqual({ id: 7, unicorn: { treasures: [{ id: 1 }] } });
      expect(data.unicorn.treasures.length).toBe(2);
    });

    test('keeps containers that were already empty and returns an empty object when nothing survives', async () => {
      setupNested(['unicorn'], true);

      expect((await validateNested({ unicorn: {}, other: 1 })).result?.data).toEqual({ unicorn: {} });
      expect((await validateNested({ other: 1 })).result?.data).toEqual({});
    });
  });

  describe('input validation', () => {
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

function setupNested(properties: readonly string[], cropper?: boolean, reservedFields?: readonly string[]): void {
  resetState();

  pkit.context.set('roles', ['staff']);

  if (cropper === true) pkit.context.set('cropper', true);

  pkit.module('catalog').name('all').role('staff').registerActions({ update: { enabled: true, properties } });

  if (reservedFields) pkit.context.set('reservedFields', reservedFields);

  pkit.seal();
}

async function validateNested(data: Data) {
  return pkit.validate({ action: 'catalog', method: 'update', role: 'staff', permissions: ['staff::catalog::all'], data });
}

function errorCodes(validation: { errors: readonly { code: string }[] }): string[] {
  const codes: string[] = [];

  for (const error of validation.errors) codes.push(error.code);

  return codes;
}

function errorFields(validation: { errors: readonly ValidationError[] }): readonly string[] | undefined {
  const [error] = validation.errors;

  return error?.code === 'PROPERTIES_NOT_ALLOWED' ? error.fields : undefined;
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

function capturePermissions(captured: (readonly string[])[], _data: Data, _context: Context, permissions: readonly string[]): void {
  captured.push(permissions);
}

function captureData(captured: Data[], data: Data): void {
  captured.push(data);
}

function throwHookFailure(cause: unknown): never {
  throw cause;
}

function checkPublication(executedHooks: string[], data: Data): void {
  executedHooks.push('module');
  if (data.status === 'published') throw new Error('published');
}

function checkOwner(executedHooks: string[], _data: Data, context: Context): void {
  executedHooks.push('staff');
  if (context.owner !== (context.user as { id: number }).id) throw new Error('not owner');
}

async function failRecordedHook(completionOrder: string[], failure: { label: string; cause: unknown; delay: number }): Promise<never> {
  if (failure.delay > 0) await delay(failure.delay);
  completionOrder.push(failure.label);

  throw failure.cause;
}

function expectEmptyArguments(data: Data, context: Context, permissions: readonly string[]): void {
  expect(data).toEqual({});
  expect(context).toEqual({});
  expect(permissions).toEqual([STAFF_REPORTS]);
}

function readRecordedData(reads: number[], data: Data): Data {
  reads.push(1);

  return data;
}
