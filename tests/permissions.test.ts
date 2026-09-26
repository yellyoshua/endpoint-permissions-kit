import { describe, expect, test } from 'bun:test';
import type { PermissionId, RolePermissionAction, RolePermissionModule } from '../src/types';
import Pkit from '../src/index';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, setupInventory } from './helpers';

const noAccess = { find: false, update: false, create: false, remove: false };

const CRUD_NAMES = ['all', 'find', 'create', 'update', 'remove', 'update-self'];

const findId = { find: { enabled: true, properties: ['id'] } } as const;

function setupStaffCatalog() {
  const pkit = new Pkit({ roles: ['admin', 'staff', 'public'] });
  const marketing = pkit.module('marketing');

  marketing.module('dashboard').name('all').role('staff').registerActions(findId);
  marketing.module('dashboard').name('all').role('admin').registerActions(findId);

  for (const name of CRUD_NAMES) {
    marketing.module('portals').name(name).role('staff').registerActions(findId);
    pkit.module('management').module('users').name(name).role('staff').registerActions(findId);
  }

  pkit.module('management').module('users').name('all').role('admin').registerActions(findId);
  pkit.module('management').module('audit').name('all').role('admin').registerActions(findId);
  pkit.module('management').module('audit').name('all').grantTo('staff::marketing.dashboard::all').registerActions(findId);

  return pkit;
}

function actionNodes<R extends string>(role: R, modulePath: string, names: readonly string[]): RolePermissionAction<R>[] {
  const nodes: RolePermissionAction<R>[] = [];

  for (const name of names) nodes.push({ name, identifier: name, resourceName: `${role}::${modulePath}::${name}` as PermissionId<R> });

  return nodes;
}

function countActions(modules: readonly RolePermissionModule[]): number {
  let total = 0;

  for (const node of modules) total += node.actions.length + countActions(node.modules ?? []);

  return total;
}

describe('permissions', () => {
  describe('named catalog', () => {
    test('lists only assignable identifiers with their registered actions', () => {
      const { pkit } = setupInventory();

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
      const { pkit } = setupInventory();

      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS] })).toEqual({
        [STAFF_ITEMS_ALL]: { ...noAccess, find: true },
        [STAFF_REPORTS]: { ...noAccess, find: true },
      });
      expect(pkit.permissions.forUser({ role: 'admin', permissions: [ADMIN_REPORTS] })[ADMIN_ITEMS_ALL]).toEqual({ ...noAccess, find: true });
      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY] })).toEqual({
        [STAFF_ITEMS_UPDATE_ONLY]: { ...noAccess, find: true, update: true },
      });
    });

    test('grants nothing by role alone without assignments', () => {
      const { pkit } = setupInventory();

      expect(pkit.permissions.forUser({ role: 'admin', permissions: [] })).toEqual({});
      expect(pkit.permissions.forUser({ role: 'public', permissions: ['public::inventory.items::all'] })).toEqual({
        'public::inventory.items::all': noAccess,
      });
    });

    test('prefers the direct assignment over grants', () => {
      const { pkit } = setupInventory();

      const access = pkit.permissions.forUser({ role: 'admin', permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] });

      expect(access[ADMIN_ITEMS_ALL]).toEqual({ find: true, update: true, create: true, remove: true });
      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS, STAFF_ITEMS_ALL] })[STAFF_ITEMS_ALL]).toEqual({
        ...noAccess, find: true, update: true,
      });
    });
  });

  describe('identity validation', () => {
    test('validates the identity the same way validate does', () => {
      const { pkit } = setupInventory();

      expect(pkit.permissions.forUser.bind(null, { role: 'nobody' as never, permissions: [] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_ROLE' }));
      expect(pkit.permissions.forUser.bind(null, { permissions: [] } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff' } as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [ADMIN_REPORTS] })).toThrow(expect.objectContaining({ code: 'PERMISSION_ROLE_MISMATCH' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::inventory.items::old'] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_PERMISSION' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: ['staff::x'] })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    });
  });

  describe('forRole tree', () => {
    test('groups every permission of the role by module path', () => {
      const pkit = setupStaffCatalog();

      const tree = pkit.permissions.forRole('staff');

      expect(tree).toEqual({
        modules: [
          {
            name: 'marketing',
            identifier: 'marketing',
            actions: [],
            modules: [
              { name: 'dashboard', identifier: 'dashboard', actions: actionNodes('staff', 'marketing.dashboard', ['all']) },
              { name: 'portals', identifier: 'portals', actions: actionNodes('staff', 'marketing.portals', CRUD_NAMES) },
            ],
          },
          {
            name: 'management',
            identifier: 'management',
            actions: [],
            modules: [
              { name: 'users', identifier: 'users', actions: actionNodes('staff', 'management.users', CRUD_NAMES) },
            ],
          },
        ],
      });
      expect(countActions(tree.modules)).toBe(13);
      expect(tree.modules[0]?.modules?.[0]).not.toHaveProperty('modules');
      expect(tree.modules[0]).not.toHaveProperty('resourceName');
    });

    test('keeps other roles and grant-only targets out of the tree', () => {
      const pkit = setupStaffCatalog();

      expect(pkit.permissions.forRole('admin')).toEqual({
        modules: [
          {
            name: 'marketing',
            identifier: 'marketing',
            actions: [],
            modules: [{ name: 'dashboard', identifier: 'dashboard', actions: actionNodes('admin', 'marketing.dashboard', ['all']) }],
          },
          {
            name: 'management',
            identifier: 'management',
            actions: [],
            modules: [
              { name: 'users', identifier: 'users', actions: actionNodes('admin', 'management.users', ['all']) },
              { name: 'audit', identifier: 'audit', actions: actionNodes('admin', 'management.audit', ['all']) },
            ],
          },
        ],
      });
      expect(JSON.stringify(pkit.permissions.forRole('staff'))).not.toContain('audit');
    });

    test('nests deep paths under modules that also hold their own permissions', () => {
      const pkit = new Pkit({ roles: ['staff'] });

      pkit.module('reports').module('monthly').module('sales').name('all').role('staff').registerActions(findId);
      pkit.module('reports').name('summary').role('staff').registerActions(findId);
      pkit.module('__proto__').name('all').role('staff').registerActions(findId);

      expect(pkit.permissions.forRole('staff')).toEqual({
        modules: [
          {
            name: 'reports',
            identifier: 'reports',
            actions: actionNodes('staff', 'reports', ['summary']),
            modules: [
              {
                name: 'monthly',
                identifier: 'monthly',
                actions: [],
                modules: [{ name: 'sales', identifier: 'sales', actions: actionNodes('staff', 'reports.monthly.sales', ['all']) }],
              },
            ],
          },
          { name: '__proto__', identifier: '__proto__', actions: actionNodes('staff', '__proto__', ['all']) },
        ],
      });
    });

    test('returns an empty tree for a declared role without permissions', () => {
      const pkit = setupStaffCatalog();

      expect(pkit.permissions.forRole('public')).toEqual({ modules: [] });
    });

    test('rejects unknown roles and non-string input', () => {
      const pkit = setupStaffCatalog();

      expect(pkit.permissions.forRole.bind(null, 'nobody' as never)).toThrow(expect.objectContaining({ name: 'PkitError', code: 'UNKNOWN_ROLE' }));
      expect(pkit.permissions.forRole.bind(null, 7 as never)).toThrow(expect.objectContaining({ name: 'PkitError', code: 'INVALID_INPUT' }));
      expect(pkit.permissions.forRole.bind(null, undefined as never)).toThrow(expect.objectContaining({ name: 'PkitError', code: 'INVALID_INPUT' }));
    });

    test('propagates the lazy cross-check errors', () => {
      const pkit = setupStaffCatalog();

      pkit.module('management').module('users').name('all').grantTo('staff::missing::all').registerActions(findId);

      expect(pkit.permissions.forRole.bind(null, 'staff')).toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION' }));
    });

    test('reflects registrations made after a previous call', () => {
      const pkit = setupStaffCatalog();

      expect(pkit.permissions.forRole('public')).toEqual({ modules: [] });

      pkit.module('marketing').module('dashboard').name('all').role('public').registerActions(findId);

      expect(pkit.permissions.forRole('public').modules[0]?.modules?.[0]?.actions).toEqual(actionNodes('public', 'marketing.dashboard', ['all']));
    });

    test('isolates instances', () => {
      const first = setupStaffCatalog();
      const second = new Pkit({ roles: ['staff'] });

      second.module('docs').name('all').role('staff').registerActions(findId);

      expect(second.permissions.forRole('staff')).toEqual({ modules: [{ name: 'docs', identifier: 'docs', actions: actionNodes('staff', 'docs', ['all']) }] });
      expect(JSON.stringify(first.permissions.forRole('staff'))).not.toContain('docs');
    });
  });

  describe('immutability', () => {
    test('returns frozen, prototype-less views', () => {
      const { pkit } = setupInventory();

      const access = pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_REPORTS] });

      expect(Object.isFrozen(pkit.permissions.named)).toBe(true);
      expect(Object.getPrototypeOf(pkit.permissions.named)).toBeNull();
      expect(Object.isFrozen(access)).toBe(true);
      expect(Object.isFrozen(access[STAFF_ITEMS_ALL])).toBe(true);
      expect(Object.getPrototypeOf(access)).toBeNull();
    });

    test('freezes the role tree at every level', () => {
      const pkit = setupStaffCatalog();

      const tree = pkit.permissions.forRole('staff');
      const marketing = tree.modules[0];
      const portals = marketing?.modules?.[1];

      expect(Object.isFrozen(tree)).toBe(true);
      expect(Object.isFrozen(tree.modules)).toBe(true);
      expect(Object.isFrozen(marketing)).toBe(true);
      expect(Object.isFrozen(marketing?.actions)).toBe(true);
      expect(Object.isFrozen(marketing?.modules)).toBe(true);
      expect(Object.isFrozen(portals)).toBe(true);
      expect(Object.isFrozen(portals?.actions)).toBe(true);
      expect(Object.isFrozen(portals?.actions[0])).toBe(true);
    });
  });
});
