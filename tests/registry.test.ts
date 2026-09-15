import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import { ADMIN_REPORTS, STAFF_REPORTS, allowHook, resetState, setupInventory } from './helpers';

const findId = { find: { enabled: true, properties: ['id'] } } as const;

describe('registry', () => {
  beforeEach(resetState);

  describe('role catalog', () => {
    test('rejects an undeclared role with the pkit.config.js hint', () => {
      const admin = pkit.module('items').name('all').role('admin');

      expect(admin.registerActions.bind(null, findId)).toThrow(/role "admin" is not declared\. Available roles: general\./);
      expect(admin.hook.bind(null, 'find', allowHook)).toThrow(/role "admin" is not declared/);
      expect(admin.registerActions.bind(null, findId)).toThrow(expect.objectContaining({ code: 'ROLE_NOT_DECLARED', name: 'PkitError' }));
    });

    test('contains exactly the declared roles without an implicit general', () => {
      pkit.context.set('roles', ['admin']);

      expect(pkit.context.get('roles')).toEqual(['admin']);
      expect(pkit.module('items').name('all').role('general').registerActions.bind(null, findId)).toThrow(/role "general" is not declared/);
    });

    test('uses general as the only role when no catalog is declared', () => {
      const items = pkit.module('items').name('all');

      expect(pkit.context.get('roles')).toEqual(['general']);
      expect(items.role('general').registerActions(findId)).toBeDefined();
      expect(items.role('staff').registerActions.bind(null, findId)).toThrow(/role "staff" is not declared/);
    });

    test('requires roles to be declared before the first registration', () => {
      pkit.module('items').name('all').role('general').registerActions(findId);

      expect(pkit.context.set.bind(null, 'roles', ['admin'])).toThrow(/roles must be declared before registering permissions: import pkit.config.js first/);
    });

    test.each([{ roles: null }, { roles: undefined }, { roles: [''] }, { roles: [1] }, { roles: Array(1) }])(
      'rejects an invalid catalog %j without replacing its roles', ({ roles }: { roles: unknown }) => {
        expect(pkit.context.set.bind(null, 'roles', roles as never)).toThrow(/roles must be an array of non-empty strings/);
        expect(pkit.context.get('roles')).toEqual(['general']);
      },
    );

    test('rejects the global hook marker as a role', () => {
      expect(pkit.context.set.bind(null, 'roles', ['staff', '*'])).toThrow(/"\*" is reserved for global hooks/);
      expect(pkit.context.get('roles')).toEqual(['general']);
    });
  });

  describe('duplicate registrations', () => {
    test('throws DUPLICATE_REGISTRATION for the same (module, name, role) twice but not another name', () => {
      const items = pkit.module('items');

      items.name('all').role('general').registerActions(findId);

      expect(items.name('all').role('general').registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(/already has actions registered for role/);
      expect(items.name('other').role('general').registerActions(findId)).toBeDefined();
    });

    test('throws DUPLICATE_REGISTRATION for the same grant twice', () => {
      const { itemsAll } = setupInventory();

      expect(itemsAll.grantTo(ADMIN_REPORTS).registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(/already has a grant for/);
    });
  });

  describe('input validation', () => {
    test('throws INVALID_DEFINITION for an invalid actions literal', () => {
      const general = pkit.module('items').name('all').role('general');

      expect(general.registerActions.bind(null, { list: { properties: [], enabled: true } } as never)).toThrow(/method "list" does not exist/);
      expect(general.registerActions.bind(null, { find: { properties: 'all', enabled: true } } as never)).toThrow(/properties must be string\[\] or '\*'/);
      expect(general.registerActions.bind(null, { find: { properties: [] } } as never)).toThrow(/enabled must be a boolean/);
    });

    test.each(['a.b', 'a:b', ' a', 'a ', '', 3])('throws INVALID_DEFINITION for invalid module segment %j', (segment: unknown) => {
      expect(pkit.module.bind(null, segment as never)).toThrow(/invalid module name/);
      expect(pkit.module('items').module.bind(null, segment as never)).toThrow(/invalid module name/);
    });

    test.each(['*', 'a:b', ' x', 'x ', '', 3])('throws INVALID_DEFINITION for invalid permission name %j', (name: unknown) => {
      expect(pkit.module('items').name.bind(null, name as never)).toThrow(/invalid permission name/);
    });

    test.each([{ actions: null }, { actions: undefined }, { actions: [] }, { actions: false }])('rejects the registerActions literal %j', ({ actions }: { actions: unknown }) => {
      expect(pkit.module('items').name('all').role('general').registerActions.bind(null, actions as never)).toThrow(/registerActions expects an object/);
    });
  });

  describe('grants', () => {
    test.each(['staff::x', 'staff::inventory.items::', 'staff:: x::y', 'staff::a..b::y', '*::x::y', 'staff::x::*', 'staff:::x::y'])(
      'throws INVALID_DEFINITION for invalid grantTo identifier %j', (permissionId: string) => {
        pkit.context.set('roles', ['staff']);

        expect(pkit.module('items').name('all').grantTo(permissionId as never).registerActions.bind(null, findId)).toThrow(/invalid grantTo identifier/);
      },
    );

    test('rejects enabled: false, wildcard, undeclared role and self reference', () => {
      pkit.context.set('roles', ['staff']);
      const items = pkit.module('items').name('all');

      expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: false, properties: [] } } as never)).toThrow(/a grant does not allow enabled: false/);
      expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: true, properties: '*' } } as never)).toThrow(/a grant requires an explicit properties list/);
      expect(items.grantTo('admin::reports::all' as never).registerActions.bind(null, findId)).toThrow(/role "admin" is not declared/);
      expect(items.grantTo('staff::items::all').registerActions.bind(null, findId)).toThrow(/cannot grant to itself/);
    });

    test('accepts a role hook whose only path is a grant and mutual grants', () => {
      const { itemsUpdateOnly, reports } = setupInventory();

      itemsUpdateOnly.role('admin').hook('find', allowHook);
      reports.grantTo('staff::inventory.items::all').registerActions(findId);
      pkit.seal();

      expect(pkit.permissions.named[STAFF_REPORTS]).toBeDefined();
    });
  });

  describe('seal', () => {
    test('rejects names without actions even when they have hooks or grants', () => {
      pkit.context.set('roles', ['staff']);
      pkit.module('items').name('all').hook('find', allowHook);

      expect(pkit.seal.bind(null)).toThrow(/"items::all" has no registered actions for any role/);

      resetState();
      pkit.context.set('roles', ['staff']);
      pkit.module('reports').name('all').role('staff').registerActions(findId);
      pkit.module('items').name('all').grantTo('staff::reports::all').registerActions(findId);

      expect(pkit.seal.bind(null)).toThrow(/"items::all" has no registered actions for any role/);
    });

    test('rejects grants whose source or method does not exist', () => {
      pkit.context.set('roles', ['staff', 'admin']);
      const items = pkit.module('items').name('all');

      items.role('staff').registerActions(findId);
      items.grantTo('staff::reports::all').registerActions(findId);

      expect(pkit.seal.bind(null)).toThrow(/grantTo "staff::reports::all" references a permission with no registered actions/);

      pkit.module('reports').name('all').role('admin').registerActions(findId);

      expect(pkit.seal.bind(null)).toThrow(/grantTo "staff::reports::all" references a permission with no registered actions/);

      pkit.module('reports').name('all').role('staff').registerActions(findId);
      items.grantTo('admin::reports::all').registerActions({ remove: { enabled: true, properties: ['id'] } });

      expect(pkit.seal.bind(null)).toThrow(/grantTo "admin::reports::all" grants "remove", which no role declares/);
    });

    test('rejects a role hook without direct definition or grant for that role', () => {
      setupInventory().itemsUpdateOnly.role('public').hook('find', allowHook);

      expect(pkit.seal.bind(null)).toThrow(/hook for "public" on "find" has no registered actions or grant for that role/);
    });

    test('throws SEALED on every registration after seal() and seal() is idempotent', () => {
      const { items, itemsAll } = setupInventory();

      pkit.seal();
      pkit.seal();

      expect(itemsAll.role('public').registerActions.bind(null, findId)).toThrow(/pkit.seal\(\) was already called: no more registrations allowed/);
      expect(itemsAll.grantTo(STAFF_REPORTS).registerActions.bind(null, findId)).toThrow(/pkit.seal\(\) was already called: no more registrations allowed/);
      expect(itemsAll.hook.bind(null, 'find', allowHook)).toThrow(/pkit.seal\(\) was already called: no more registrations allowed/);
      expect(items.hook.bind(null, 'find', allowHook)).toThrow(/pkit.seal\(\) was already called: no more registrations allowed/);
      expect(pkit.context.set.bind(null, 'roles', ['x'])).toThrow(/pkit.seal\(\) was already called: no more registrations allowed/);
    });
  });

  describe('registration semantics', () => {
    test('copies and freezes definitions', () => {
      const properties = ['id'];

      pkit.module('items').name('all').role('general').registerActions({ find: { properties, enabled: true } });
      properties.push('secret');
      pkit.seal();

      expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['id']);
    });

    test('does not create modules or lock the role catalog on a failed registration', () => {
      expect(pkit.module('items').name('all').role('general').registerActions.bind(null, { find: { enabled: 'yes', properties: [] } } as never)).toThrow();

      pkit.context.set('roles', ['staff']);

      expect(pkit.context.get('roles')).toEqual(['staff']);

      pkit.seal();

      expect(pkit.permissions.named).toEqual({});
    });

    test('registers a multi-method literal completely or not at all', () => {
      const general = pkit.module('items').name('all').role('general');

      expect(general.registerActions.bind(null, {
        find: { enabled: true, properties: ['id'] },
        update: { enabled: true, properties: null },
      } as never)).toThrow();

      general.registerActions({ find: { enabled: true, properties: ['name'] } });
      pkit.seal();

      expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['name']);
    });

    test('preserves builder identity, scope and extracted methods', () => {
      pkit.context.set('roles', ['staff']);
      const items = pkit.module('items');
      const itemsAll = items.name('all');
      const itemsReadOnly = items.name('read-only');
      const staff = itemsAll.role('staff');
      const { registerActions, hook } = staff;

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

      pkit.seal();

      expect(Object.keys(pkit.permissions.named).sort()).toEqual(['staff::items.reports::all', 'staff::items::all', 'staff::items::read-only']);
      expect(pkit.permissions.named['staff::items::all']?.update).toBeDefined();
      expect(pkit.permissions.named['staff::items::read-only']?.update).toBeUndefined();
    });
  });
});
