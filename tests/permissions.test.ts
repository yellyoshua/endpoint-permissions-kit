import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, resetState, setupInventory } from './helpers';

const noAccess = { find: false, update: false, create: false, remove: false };

describe('permissions', () => {
  beforeEach(resetState);

  describe('sealing', () => {
    test('throws NOT_SEALED from named and forUser before seal()', () => {
      setupInventory();

      expect(readCatalog).toThrow(/pkit\.seal\(\) has not been called/);
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [] })).toThrow(/pkit\.seal\(\) has not been called/);
    });
  });

  describe('named catalog', () => {
    test('lists only assignable identifiers with their registered actions', () => {
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
    });
  });

  describe('forUser resolution', () => {
    test('resolves direct assignments and one-hop grants', () => {
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
    });

    test('grants nothing by role alone without assignments', () => {
      setupInventory();
      pkit.seal();

      expect(pkit.permissions.forUser({ role: 'admin', permissions: [] })).toEqual({});
      expect(pkit.permissions.forUser({ role: 'public', permissions: ['public::inventory.items::all'] })).toEqual({
        'public::inventory.items::all': noAccess,
      });
    });

    test('prefers the direct assignment over grants', () => {
      setupInventory();
      pkit.seal();

      const access = pkit.permissions.forUser({ role: 'admin', permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] });

      expect(access[ADMIN_ITEMS_ALL]).toEqual({ find: true, update: true, create: true, remove: true });
      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS, STAFF_ITEMS_ALL] })[STAFF_ITEMS_ALL]).toEqual({
        ...noAccess, find: true, update: true,
      });
    });
  });

  describe('identity validation', () => {
    test('validates the identity the same way validate does', () => {
      setupInventory();
      pkit.seal();

      expect(pkit.permissions.forUser.bind(null, { role: 'nobody' as never, permissions: [] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_ROLE' }));
      expect(pkit.permissions.forUser.bind(null, { permissions: [] } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff' } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [ADMIN_REPORTS] })).toThrow(expect.objectContaining({ code: 'PERMISSION_ROLE_MISMATCH' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::inventory.items::old'] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_PERMISSION' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::x'] })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
  });

  describe('immutability', () => {
    test('returns frozen, prototype-less views', () => {
      setupInventory();
      pkit.seal();

      const access = pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS] });

      expect(Object.isFrozen(pkit.permissions.named)).toBe(true);
      expect(Object.getPrototypeOf(pkit.permissions.named)).toBeNull();
      expect(Object.isFrozen(access)).toBe(true);
      expect(Object.isFrozen(access[STAFF_ITEMS_ALL])).toBe(true);
      expect(Object.getPrototypeOf(access)).toBeNull();
    });
  });
});

function readCatalog() { return pkit.permissions.named; }
