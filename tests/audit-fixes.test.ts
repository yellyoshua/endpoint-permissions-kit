import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import type { ValidationError } from '../src/types';
import { resetState, setupInventory, STAFF_ITEMS_ALL } from './helpers';

const staffItems = { action: 'inventory.items', name: 'all', role: 'staff', permissions: [STAFF_ITEMS_ALL] } as const;
const INVALID_DEFINITION = expect.objectContaining({ code: 'INVALID_DEFINITION' });

let hookRuns = 0;

beforeEach(resetState);
beforeEach(resetHookRuns);

function resetHookRuns(): void { hookRuns = 0; }
function countHook(): void { hookRuns += 1; }
function noop(): void {}
function throwLegit(): void { throw new Error('legit'); }
function throwUndescribable(): void { throw { toString: throwFromToString }; }
function throwFromToString(): string { throw new Error('boom'); }
function codeOf(error: ValidationError): string { return error.code; }

test.each([
  { method: undefined }, { method: null }, { method: 'delete' }, { method: '__proto__' },
  { method: ['update'] }, { method: [['update']] }, { method: ['find'] },
])('method inválido $method produce INVALID_INPUT y no corre hooks', rejectInvalidMethod);
test('method válido sigue ejecutando los hooks', keepHooksForValidMethod);
test('role("*") lanza INVALID_DEFINITION', rejectReservedRole);
test.each([
  { roles: ['m:n'] }, { roles: ['a::b'] }, { roles: [' x'] }, { roles: ['*'] }, { roles: [] },
])('catálogo de roles $roles lanza INVALID_DEFINITION', rejectCatalog);
test('un hook que lanza un valor indescriptible sigue siendo HOOK_ERROR junto a los demás', describeHookFailure);
test('un módulo con hooks y sin nombres no sella', rejectDeadModuleHook);
test.each([
  { properties: ['*'] }, { properties: [''] }, { properties: ['id', 'id'] },
])('properties $properties lanza INVALID_DEFINITION', rejectProperties);
test('context y permissions están congelados', frozenViews);
test('la unión de concesiones conserva orden de inserción sin duplicados', grantedUnionOrder);

async function rejectInvalidMethod({ method }: { method: unknown }): Promise<void> {
  const { itemsAll } = setupInventory();
  itemsAll.hook('update', countHook);
  itemsAll.hook('find', countHook);
  pkit.seal();

  const validation = await pkit.validate({ ...staffItems, method, data: { id: 1 } } as never);
  expect(validation.result).toBeNull();
  expect(validation.errors[0]?.code).toBe('INVALID_INPUT');
  expect(hookRuns).toBe(0);
}

async function keepHooksForValidMethod(): Promise<void> {
  const { itemsAll } = setupInventory();
  itemsAll.hook('update', countHook);
  pkit.seal();

  const validation = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1 } });
  expect(validation.errors).toEqual([]);
  expect(hookRuns).toBe(1);
}

function rejectReservedRole(): void {
  const { itemsAll } = setupInventory();
  expect(itemsAll.role.bind(null, '*' as never)).toThrow(/reservado/);
}

function rejectCatalog({ roles }: { roles: readonly string[] }): void {
  expect(pkit.context.set.bind(null, 'roles', roles)).toThrow(INVALID_DEFINITION);
}

async function describeHookFailure(): Promise<void> {
  const { itemsAll } = setupInventory();
  itemsAll.hook('find', throwUndescribable);
  itemsAll.hook('find', throwLegit);
  pkit.seal();

  const validation = await pkit.validate({ ...staffItems, method: 'find' });
  expect(validation.errors.map(codeOf)).toEqual(['HOOK_ERROR', 'HOOK_ERROR']);
  expect(validation.errors[1]?.message).toBe('legit');
}

function rejectDeadModuleHook(): void {
  setupInventory();
  pkit.module('inventory').hook('remove', noop);
  expect(pkit.seal).toThrow(/ningún nombre con acciones/);
}

function rejectProperties({ properties }: { properties: readonly string[] }): void {
  setupInventory();
  const fresh = pkit.module('inventory').name('fresh').role('public');
  expect(fresh.registerActions.bind(null, { update: { enabled: true, properties } })).toThrow(INVALID_DEFINITION);
}

function frozenViews(): void {
  expect(Object.isFrozen(pkit.context)).toBe(true);
  expect(Object.isFrozen(pkit.permissions)).toBe(true);
}

async function grantedUnionOrder(): Promise<void> {
  resetState();
  pkit.context.set('roles', ['staff']);
  pkit.module('s1').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['x'] } });
  pkit.module('s2').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['x'] } });
  const target = pkit.module('t').name('all');
  target.role('staff').registerActions({ find: { enabled: true, properties: ['a', 'b', 'c'] } });
  target.grantTo('staff::s1::all').registerActions({ find: { enabled: true, properties: ['b', 'a'] } });
  target.grantTo('staff::s2::all').registerActions({ find: { enabled: true, properties: ['c', 'a'] } });
  pkit.seal();

  const validation = await pkit.validate({ action: 't', name: 'all', method: 'find', role: 'staff', permissions: ['staff::s1::all', 'staff::s2::all'] });
  expect(validation.result).toEqual(['b', 'a', 'c']);
}
