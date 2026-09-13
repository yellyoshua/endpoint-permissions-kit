import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, resetState, setupInventory } from './helpers';

beforeEach(resetState);

const noAccess = { find: false, update: false, create: false, remove: false };

test('named y forUser antes de seal() lanzan NOT_SEALED', rejectUnsealedViews);
test('named contiene solo identificadores asignables con sus acciones registradas', materializeNamedCatalog);
test('forUser resuelve asignaciones directas y concesiones de un salto', materializeUserAccess);
test('forUser sin asignaciones no concede nada por el rol', denyWithoutAssignments);
test('forUser aplica la precedencia de la asignación directa', preferDirectAssignment);
test('forUser valida la identidad igual que validate', rejectInvalidIdentity);
test('las vistas son de solo lectura', freezePermissionViews);

function rejectUnsealedViews() {
  setupInventory();

  expect(readCatalog).toThrow(/falta pkit.seal\(\)/);
  expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [] })).toThrow(/falta pkit.seal\(\)/);
}

function materializeNamedCatalog() {
  setupInventory();
  pkit.seal();
  const catalog = pkit.permissions.named;

  expect(Object.keys(catalog).sort()).toEqual([
    ADMIN_ITEMS_ALL,
    ADMIN_REPORTS,
    'public::inventory.items::all',
    STAFF_ITEMS_ALL,
    STAFF_ITEMS_UPDATE_ONLY,
    STAFF_REPORTS,
  ]);
  expect(catalog[STAFF_ITEMS_ALL]).toEqual({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
    update: { enabled: true, properties: ['id', 'name', 'description'] },
    create: { enabled: false, properties: [] },
  });
  expect(catalog['admin::inventory.items::update-only']).toBeUndefined();
}

function materializeUserAccess() {
  setupInventory();
  pkit.seal();

  expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS] })).toEqual({
    [STAFF_ITEMS_ALL]: { ...noAccess, find: true },
    [STAFF_ITEMS_UPDATE_ONLY]: { ...noAccess, find: true },
    [STAFF_REPORTS]: { ...noAccess, find: true },
  });
  expect(pkit.permissions.forUser({ role: 'admin', permissions: [ADMIN_REPORTS] })['admin::inventory.items::update-only']).toEqual({ ...noAccess, find: true });
  expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY] })).toEqual({
    [STAFF_ITEMS_UPDATE_ONLY]: { ...noAccess, find: true, update: true },
  });
}

function denyWithoutAssignments() {
  setupInventory();
  pkit.seal();

  expect(pkit.permissions.forUser({ role: 'admin', permissions: [] })).toEqual({});
  expect(pkit.permissions.forUser({ role: 'public', permissions: ['public::inventory.items::all'] })).toEqual({
    'public::inventory.items::all': noAccess,
  });
}

function preferDirectAssignment() {
  setupInventory();
  pkit.seal();
  const access = pkit.permissions.forUser({ role: 'admin', permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] });

  expect(access[ADMIN_ITEMS_ALL]).toEqual({ find: true, update: true, create: true, remove: true });
  expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS, STAFF_ITEMS_ALL] })[STAFF_ITEMS_ALL]).toEqual({
    ...noAccess, find: true, update: true,
  });
}

function rejectInvalidIdentity() {
  setupInventory();
  pkit.seal();

  expect(pkit.permissions.forUser.bind(null, { role: 'nobody' as never, permissions: [] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_ROLE' }));
  expect(pkit.permissions.forUser.bind(null, { permissions: [] } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(pkit.permissions.forUser.bind(null, { role: 'staff' } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [ADMIN_REPORTS] })).toThrow(expect.objectContaining({ code: 'PERMISSION_ROLE_MISMATCH' }));
  expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::inventory.items::old'] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_PERMISSION' }));
  expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::x'] })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
}

function freezePermissionViews() {
  setupInventory();
  pkit.seal();
  const access = pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS] });

  expect(Object.isFrozen(pkit.permissions.named)).toBe(true);
  expect(Object.getPrototypeOf(pkit.permissions.named)).toBeNull();
  expect(Object.isFrozen(access)).toBe(true);
  expect(Object.isFrozen(access[STAFF_ITEMS_ALL])).toBe(true);
  expect(Object.getPrototypeOf(access)).toBeNull();
}

function readCatalog() { return pkit.permissions.named; }
