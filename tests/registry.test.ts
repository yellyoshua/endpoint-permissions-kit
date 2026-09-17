import { describe, expect, test } from 'bun:test';
import Pkit from '../src/index';
import { ADMIN_REPORTS, STAFF_REPORTS, allowHook, setupInventory } from './helpers';

const findId = { find: { enabled: true, properties: ['id'] } } as const;

function invalidDefinition() {
  return expect.objectContaining({ code: 'INVALID_DEFINITION', name: 'PkitError' });
}

describe('registry', () => {
  describe('role catalog', () => {
    test('rejects an undeclared role with the Pkit constructor hint', () => {
      const pkit = new Pkit();
      const all = pkit.module('items').name('all');

      expect(function () { return all.role('admin' as never); }).toThrow(/Role admin is not declared: pass it in the roles option of the Pkit constructor/);
      expect(function () { return all.role('admin' as never); }).toThrow(expect.objectContaining({ code: 'ROLE_NOT_DECLARED', name: 'PkitError' }));
    });

    test('contains exactly the declared roles without an implicit general', () => {
      const pkit = new Pkit({ roles: ['admin'] });

      expect(pkit.context.get('roles')).toEqual(['admin']);
      expect(function () { return pkit.module('items').name('all').role('general' as never); }).toThrow(/Role general is not declared/);
    });

    test('uses general as the only role when no catalog is declared', () => {
      const pkit = new Pkit();
      const items = pkit.module('items').name('all');

      expect(pkit.context.get('roles')).toEqual(['general']);
      expect(items.role('general').registerActions(findId)).toBeDefined();
      expect(function () { return items.role('staff' as never); }).toThrow(/Role staff is not declared/);
    });

    test.each([{ roles: null }, { roles: undefined }, { roles: [] }, { roles: [''] }, { roles: [1] }, { roles: Array(1) }])(
      'rejects an invalid catalog %j without replacing its roles', ({ roles }: { roles: unknown }) => {
        const pkit = new Pkit();

        expect(pkit.context.set.bind(null, 'roles', roles as never)).toThrow(invalidDefinition());
        if (roles !== undefined) expect(function () { return new Pkit({ roles: roles as never }); }).toThrow(invalidDefinition());
        expect(pkit.context.get('roles')).toEqual(['general']);
      },
    );

    test('rejects the global hook marker as a role', () => {
      const pkit = new Pkit();

      expect(pkit.context.set.bind(null, 'roles', ['staff', '*'])).toThrow(/Invalid role: \*/);
      expect(function () { return new Pkit({ roles: ['staff', '*'] }); }).toThrow(/Invalid role: \*/);
      expect(pkit.context.get('roles')).toEqual(['general']);
    });
  });

  describe('duplicate registrations', () => {
    test('throws DUPLICATE_REGISTRATION for the same (module, name, role) twice but not another name', () => {
      const pkit = new Pkit();
      const items = pkit.module('items');

      items.name('all').role('general').registerActions(findId);

      expect(items.name('all').role('general').registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(/already has registered actions/);
      expect(items.name('all').role('general').registerActions.bind(null, findId)).toThrow(expect.objectContaining({ code: 'DUPLICATE_REGISTRATION' }));
      expect(items.name('other').role('general').registerActions(findId)).toBeDefined();
    });

    test('throws DUPLICATE_REGISTRATION for the same grant twice', () => {
      const { itemsAll } = setupInventory();

      expect(itemsAll.grantTo(ADMIN_REPORTS).registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(expect.objectContaining({ code: 'DUPLICATE_REGISTRATION' }));
    });
  });

  describe('input validation', () => {
    test('throws INVALID_DEFINITION for an invalid actions literal', () => {
      const general = new Pkit().module('items').name('all').role('general');

      expect(general.registerActions.bind(null, { list: { properties: [], enabled: true } } as never)).toThrow(/Unknown method: list/);
      expect(general.registerActions.bind(null, { find: { properties: 'all', enabled: true } } as never)).toThrow(/must be an array of property paths/);
      expect(general.registerActions.bind(null, { find: { properties: [] } } as never)).toThrow(/must declare a boolean enabled flag/);
      expect(general.registerActions.bind(null, { find: { properties: [] } } as never)).toThrow(invalidDefinition());
    });

    test.each(['a.b', 'a:b', ' a', 'a ', '', 3])('throws INVALID_DEFINITION for invalid module segment %j', (segment: unknown) => {
      const pkit = new Pkit();

      expect(pkit.module.bind(null, segment as never)).toThrow(/Invalid module segment/);
      expect(pkit.module('items').module.bind(null, segment as never)).toThrow(/Invalid module segment/);
    });

    test.each(['*', 'a:b', ' x', 'x ', '', 3])('throws INVALID_DEFINITION for invalid permission name %j', (name: unknown) => {
      expect(new Pkit().module('items').name.bind(null, name as never)).toThrow(/Invalid permission name/);
    });

    test.each([{ actions: null }, { actions: undefined }, { actions: [] }, { actions: false }])('rejects the registerActions literal %j', ({ actions }: { actions: unknown }) => {
      expect(new Pkit().module('items').name('all').role('general').registerActions.bind(null, actions as never)).toThrow(/registerActions expects an object/);
    });
  });

  describe('grants', () => {
    test.each(['staff::x', 'staff::inventory.items::', 'staff:: x::y', 'staff::a..b::y', '*::x::y', 'staff::x::*', 'staff:::x::y'])(
      'throws INVALID_DEFINITION for invalid grantTo identifier %j', (permissionId: string) => {
        const pkit = new Pkit({ roles: ['staff'] });

        expect(pkit.module('items').name('all').grantTo(permissionId as never).registerActions.bind(null, findId)).toThrow(/Invalid grant identifier/);
      },
    );

    test('rejects enabled: false, wildcard, undeclared role and self reference', () => {
      const pkit = new Pkit({ roles: ['staff'] });
      const items = pkit.module('items').name('all');

      expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: false, properties: [] } } as never)).toThrow(/must be enabled: a grant is opt-in/);
      expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: true, properties: '*' } } as never)).toThrow(/must list its properties explicitly/);
      expect(items.grantTo('admin::reports::all' as never).registerActions.bind(null, findId)).toThrow(/Role admin of grant admin::reports::all is not declared/);
      expect(items.grantTo('staff::items::all').registerActions.bind(null, findId)).toThrow(/references its own permission/);
    });

    test('accepts a role hook whose only path is a grant and mutual grants', () => {
      const { pkit, itemsUpdateOnly, reports } = setupInventory();

      itemsUpdateOnly.grantTo(ADMIN_REPORTS).registerActions(findId);
      itemsUpdateOnly.role('admin').hook('find', allowHook);
      reports.grantTo('staff::inventory.items::all').registerActions(findId);

      expect(pkit.permissions.named[STAFF_REPORTS]).toBeDefined();
    });
  });

  describe('cross checks when the views are built', () => {
    test('rejects names without actions even when they have hooks or grants', () => {
      const withHook = new Pkit({ roles: ['staff'] });

      withHook.module('items').name('all').hook('find', allowHook);

      expect(function () { return withHook.permissions.named; }).toThrow(invalidDefinition());

      const withGrant = new Pkit({ roles: ['staff'] });

      withGrant.module('reports').name('all').role('staff').registerActions(findId);
      withGrant.module('items').name('all').grantTo('staff::reports::all').registerActions(findId);

      expect(function () { return withGrant.permissions.named; }).toThrow(invalidDefinition());
    });

    test('rejects grants whose source or method does not exist', () => {
      const pkit = new Pkit({ roles: ['staff', 'admin'] });
      const items = pkit.module('items').name('all');

      items.role('staff').registerActions(findId);
      items.grantTo('staff::reports::all').registerActions(findId);

      expect(function () { return pkit.permissions.named; }).toThrow(invalidDefinition());

      pkit.module('reports').name('all').role('admin').registerActions(findId);

      expect(function () { return pkit.permissions.named; }).toThrow(invalidDefinition());

      pkit.module('reports').name('all').role('staff').registerActions(findId);

      expect(pkit.permissions.named['staff::reports::all']).toBeDefined();

      items.grantTo('admin::reports::all').registerActions({ remove: { enabled: true, properties: ['id'] } });

      expect(function () { return pkit.permissions.named; }).toThrow(invalidDefinition());
    });

    test('rejects a role hook without direct definition or grant for that role', () => {
      const { pkit, itemsUpdateOnly } = setupInventory();

      itemsUpdateOnly.role('public').hook('find', allowHook);

      expect(function () { return pkit.permissions.named; }).toThrow(invalidDefinition());
      expect(function () { return pkit.permissions.forUser({ role: 'staff', permissions: [] }); }).toThrow(invalidDefinition());
    });
  });

  describe('registration semantics', () => {
    test('copies and freezes definitions', () => {
      const pkit = new Pkit();
      const properties = ['id'];

      pkit.module('items').name('all').role('general').registerActions({ find: { properties, enabled: true } });
      properties.push('secret');

      expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['id']);
      expect(Object.isFrozen(pkit.permissions.named['general::items::all']?.find?.properties)).toBe(true);
    });

    test('does not create modules on a failed registration', () => {
      const pkit = new Pkit();

      expect(pkit.module('items').name('all').role('general').registerActions.bind(null, { find: { enabled: 'yes', properties: [] } } as never)).toThrow();

      expect(pkit.permissions.named).toEqual({});
    });

    test('registers a multi-method literal completely or not at all', () => {
      const pkit = new Pkit();
      const general = pkit.module('items').name('all').role('general');

      expect(general.registerActions.bind(null, {
        find: { enabled: true, properties: ['id'] },
        update: { enabled: true, properties: null },
      } as never)).toThrow();

      general.registerActions({ find: { enabled: true, properties: ['name'] } });

      expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['name']);
    });

    test('preserves builder identity, scope and extracted methods', () => {
      const pkit = new Pkit({ roles: ['staff'] });
      const items = pkit.module('items');
      const itemsAll = items.name('all');
      const itemsReadOnly = items.name('read-only');
      const staff = itemsAll.role('staff');
      const { registerActions, hook } = staff;

      expect(pkit.module('items')).toBe(items);
      expect(items.name('all')).toBe(itemsAll);
      expect(itemsAll.role('staff')).toBe(staff);
      expect(registerActions({ find: { enabled: true, properties: ['id'] }, update: { enabled: true, properties: ['id'] } })).toBe(staff);
      expect(hook('find', allowHook)).toBe(staff);
      expect(itemsAll.hook('find', allowHook)).toBe(itemsAll);
      expect(items.hook('find', allowHook)).toBe(items);
      expect(Object.keys(staff).sort()).toEqual(['hook', 'registerActions']);
      expect(Object.keys(itemsAll).sort()).toEqual(['grantTo', 'hook', 'role']);
      expect(Object.keys(items).sort()).toEqual(['hook', 'module', 'name']);

      const { role: readOnlyRole } = itemsReadOnly;

      readOnlyRole('staff').registerActions({ find: { enabled: true, properties: ['name'] } });

      const { module: defineChild } = items;

      defineChild('reports').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['name'] } });

      expect(Object.keys(pkit.permissions.named).sort()).toEqual(['staff::items.reports::all', 'staff::items::all', 'staff::items::read-only']);
      expect(pkit.permissions.named['staff::items::all']?.update).toBeDefined();
      expect(pkit.permissions.named['staff::items::read-only']?.update).toBeUndefined();
    });
  });
});
