import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import type { ValidationError } from '../src/types';
import { resetState, setupInventory, STAFF_ITEMS_ALL } from './helpers';

const staffItems = { action: 'inventory.items', role: 'staff', permissions: [STAFF_ITEMS_ALL] } as const;
const INVALID_DEFINITION = expect.objectContaining({ code: 'INVALID_DEFINITION' });

let hookRuns = 0;

describe('audit fixes', () => {
  beforeEach(resetState);
  beforeEach(() => {
    hookRuns = 0;
  });

  describe('method input', () => {
    test.each([
      { method: undefined }, { method: null }, { method: 'delete' }, { method: '__proto__' },
      { method: ['update'] }, { method: [['update']] }, { method: ['find'] },
    ])('rejects invalid method $method with INVALID_INPUT without running hooks', async ({ method }: { method: unknown }) => {
      const { itemsAll } = setupInventory();

      itemsAll.hook('update', countHook);
      itemsAll.hook('find', countHook);
      pkit.seal();

      const validation = await pkit.validate({ ...staffItems, method, data: { id: 1 } } as never);

      expect(validation.result).toBeNull();
      expect(validation.errors[0]?.code).toBe('INVALID_INPUT');
      expect(hookRuns).toBe(0);
    });

    test('still runs hooks for a valid method', async () => {
      const { itemsAll } = setupInventory();

      itemsAll.hook('update', countHook);
      pkit.seal();

      const validation = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1 } });

      expect(validation.errors).toEqual([]);
      expect(hookRuns).toBe(1);
    });
  });

  describe('role catalog', () => {
    test('rejects role("*") with INVALID_DEFINITION', () => {
      const { itemsAll } = setupInventory();

      expect(itemsAll.role.bind(null, '*' as never)).toThrow(/is reserved for global hooks/);
    });

    test.each([
      { roles: ['m:n'] }, { roles: ['a::b'] }, { roles: [' x'] }, { roles: ['*'] }, { roles: [] },
    ])('rejects role catalog $roles with INVALID_DEFINITION', ({ roles }: { roles: readonly string[] }) => {
      expect(pkit.context.set.bind(null, 'roles', roles)).toThrow(INVALID_DEFINITION);
    });
  });

  describe('hooks', () => {
    test('reports a hook throwing an undescribable value as HOOK_ERROR alongside the others', async () => {
      const { itemsAll } = setupInventory();

      itemsAll.hook('find', throwUndescribable);
      itemsAll.hook('find', throwLegit);
      pkit.seal();

      const validation = await pkit.validate({ ...staffItems, method: 'find' });

      expect(validation.errors.map(codeOf)).toEqual(['HOOK_ERROR', 'HOOK_ERROR']);
      expect(validation.errors[1]?.message).toBe('legit');
    });

    test('refuses to seal a module with hooks but no names', () => {
      setupInventory();
      pkit.module('inventory').hook('remove', noop);

      expect(pkit.seal).toThrow(/has hooks but no name with registered actions/);
    });
  });

  describe('properties', () => {
    test.each([
      { properties: ['*'] }, { properties: [''] }, { properties: ['id', 'id'] },
    ])('rejects properties $properties with INVALID_DEFINITION', ({ properties }: { properties: readonly string[] }) => {
      setupInventory();
      const fresh = pkit.module('inventory').name('fresh').role('public');

      expect(fresh.registerActions.bind(null, { update: { enabled: true, properties } })).toThrow(INVALID_DEFINITION);
    });
  });

  describe('views', () => {
    test('freezes context and permissions', () => {
      expect(Object.isFrozen(pkit.context)).toBe(true);
      expect(Object.isFrozen(pkit.permissions)).toBe(true);
    });
  });

  describe('grant union', () => {
    test('unites the fields of every applicable grant', async () => {
      resetState();
      pkit.context.set('roles', ['staff']);
      pkit.module('s1').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['x'] } });
      pkit.module('s2').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['x'] } });
      const target = pkit.module('t').name('all');

      target.role('staff').registerActions({ find: { enabled: true, properties: ['a', 'b', 'c'] } });
      target.grantTo('staff::s1::all').registerActions({ find: { enabled: true, properties: ['b', 'a'] } });
      target.grantTo('staff::s2::all').registerActions({ find: { enabled: true, properties: ['c', 'a'] } });
      pkit.seal();

      const assignments = { action: 't', method: 'find', role: 'staff', permissions: ['staff::s1::all', 'staff::s2::all'] } as const;

      expect((await pkit.validate({ ...assignments, data: { a: 1, b: 2, c: 3 } })).errors).toEqual([]);

      const denied = await pkit.validate({ ...assignments, data: { a: 1, d: 4 } });

      expect(denied.errors).toEqual([expect.objectContaining({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['d'] })]);
    });
  });
});

function countHook(): void { hookRuns += 1; }

function noop(): void {}

function throwLegit(): void { throw new Error('legit'); }

function throwUndescribable(): void { throw { toString: throwFromToString }; }

function throwFromToString(): string { throw new Error('boom'); }

function codeOf(error: ValidationError): string { return error.code; }
