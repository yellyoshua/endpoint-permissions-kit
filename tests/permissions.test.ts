import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { resetState, setupPortals } from './helpers';
beforeEach(resetState);
test('all y forRole antes de seal() lanzan NOT_SEALED', rejectUnsealedViews);
test('all materializa el fallback por método', materializeRoleFallback);
test('forRole devuelve mapa plano booleano de todos los métodos', materializeRoleAccess);
test('forRole con rol desconocido lanza UNKNOWN_ROLE', rejectUnknownViewRole);
test('las vistas son de solo lectura', freezePermissionViews);

function rejectUnsealedViews() {
  setupPortals();
  expect(readCatalog).toThrow(/falta pkit.seal\(\)/);
  expect(pkit.permissions.forRole.bind(null, 'staff')).toThrow(/falta pkit.seal\(\)/);
}

function materializeRoleFallback() {
  setupPortals();
  pkit.seal();
  const catalog = pkit.permissions.all;
  expect(catalog.staff['marketing.portals.find']).toEqual({ enabled: true, properties: ['id', 'name', 'link'] });
  expect(catalog.staff['marketing.portals.update']).toEqual({ enabled: true, properties: ['id', 'name', 'description'] });
  expect(catalog.staff['marketing.portals.remove']).toBeUndefined();
  expect(catalog.public['marketing.portals.update']).toEqual({ enabled: false, properties: [] });
  expect(catalog.admin['marketing.portals.find']).toEqual({ enabled: true, properties: '*' });
}

function materializeRoleAccess() {
  setupPortals();
  pkit.seal();
  expect(pkit.permissions.forRole('staff')).toEqual({
    'marketing.portals.find': true,
    'marketing.portals.update': true,
    'marketing.portals.create': false,
    'marketing.portals.remove': false,
  });
  expect(pkit.permissions.forRole('public')['marketing.portals.update']).toBe(false);
}

function rejectUnknownViewRole() {
  setupPortals();
  pkit.seal();
  expect(pkit.permissions.forRole.bind(null, 'nobody' as never)).toThrow(/"nobody" no está declarado/);
}

function freezePermissionViews() {
  setupPortals();
  pkit.seal();
  expect(Object.isFrozen(pkit.permissions.all)).toBe(true);
  expect(Object.isFrozen(pkit.permissions.forRole('staff'))).toBe(true);
  expect(Object.getPrototypeOf(pkit.permissions.all)).toBeNull();
}

function readCatalog() { return pkit.permissions.all; }
