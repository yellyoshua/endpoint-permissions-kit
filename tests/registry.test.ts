import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { resetState, setupPortals, allowHook } from './helpers';
beforeEach(resetState);
test('rol no declarado lanza con la pista de pkit.config.js', rejectUndeclaredRole);
test('general siempre está en el catálogo', includeGeneralRole);
test('roles se declaran antes del primer registro', rejectLateCatalog);
test('mismo (módulo, rol) dos veces lanza DUPLICATE_REGISTRATION', rejectDuplicateActions);
test('literal inválido lanza INVALID_DEFINITION', rejectInvalidActions);
test('tras seal() todo registro lanza SEALED y seal() es idempotente', closeRegistration);
test('seal() rechaza hook de rol sobre método que ese rol no tiene ni hereda', rejectOrphanHook);
test('el registro copia y congela las definiciones', freezeDefinitions);
test('un registro inválido no crea módulos ni bloquea el catálogo de roles', avoidFailedRegistrationMutation);
test('un literal con varios métodos se registra completo o no se registra', registerActionsAtomically);
test.each([{ actions: null }, { actions: undefined }, { actions: [] }, { actions: false }])('registerActions rechaza el literal %j', rejectInvalidActionContainer);

function rejectUndeclaredRole() {
  const findActions = { find: { properties: [], enabled: true } };
  expect(pkit.module('portals').role('admin').registerActions.bind(null, findActions)).toThrow(/role "admin" no está declarado\. Roles disponibles: general\./);
  expect(pkit.module('portals').role('admin').hook.bind(null, 'find', allowHook)).toThrow(/role "admin" no está declarado/);
  expect(pkit.module('portals').role('admin').registerActions.bind(null, findActions)).toThrow(expect.objectContaining({ code: 'ROLE_NOT_DECLARED', name: 'PkitError' }));
}

function includeGeneralRole() {
  pkit.context.set('roles', ['admin']);
  expect(pkit.context.get('roles')).toEqual(['general', 'admin']);
}

function rejectLateCatalog() {
  pkit.module('portals').registerActions({ find: { properties: [], enabled: true } });
  expect(pkit.context.set.bind(null, 'roles', ['admin'])).toThrow(/antes de registrar/);
}

function rejectDuplicateActions() {
  const portals = pkit.module('portals');
  portals.registerActions({ find: { properties: [], enabled: true } });
  expect(portals.registerActions.bind(null, { update: { properties: [], enabled: true } })).toThrow(/ya tiene acciones/);
}

function rejectInvalidActions() {
  const portals = pkit.module('portals');
  expect(portals.registerActions.bind(null, { list: { properties: [], enabled: true } } as never)).toThrow(/método "list" no existe/);
  expect(portals.registerActions.bind(null, { find: { properties: 'all', enabled: true } } as never)).toThrow(/string\[\] o '\*'/);
  expect(portals.registerActions.bind(null, { find: { properties: [] } } as never)).toThrow(/enabled debe ser boolean/);
  expect(pkit.module.bind(null, 'a.b')).toThrow(/sin puntos/);
}

function closeRegistration() {
  const portals = setupPortals();
  pkit.seal();
  pkit.seal();
  expect(portals.role('public').registerActions.bind(null, { find: { properties: [], enabled: true } })).toThrow(/ya fue llamado/);
  expect(portals.hook.bind(null, 'find', allowHook)).toThrow(/ya fue llamado/);
  expect(pkit.context.set.bind(null, 'roles', ['x'])).toThrow(/ya fue llamado/);
}

function rejectOrphanHook() {
  setupPortals().role('public').hook('remove', allowHook);
  expect(pkit.seal.bind(null)).toThrow(/hook de "public" en "remove"/);
}

function freezeDefinitions() {
  const properties = ['id'];
  pkit.module('portals').registerActions({ find: { properties, enabled: true } });
  properties.push('secret');
  pkit.seal();
  expect(pkit.permissions.all.general['portals.find']?.properties).toEqual(['id']);
}

function avoidFailedRegistrationMutation() {
  expect(pkit.module('portals').registerActions.bind(null, { find: { enabled: 'yes', properties: [] } } as never)).toThrow();
  pkit.context.set('roles', ['staff']);
  expect(pkit.context.get('roles')).toEqual(['general', 'staff']);
  pkit.seal();
  expect(pkit.permissions.forRole()).toEqual({});
}

function registerActionsAtomically() {
  const portals = pkit.module('portals');
  expect(portals.registerActions.bind(null, {
    find: { enabled: true, properties: ['id'] },
    update: { enabled: true, properties: null },
  } as never)).toThrow();
  portals.registerActions({ find: { enabled: true, properties: ['name'] } });
  pkit.seal();
  expect(pkit.permissions.all.general['portals.find']?.properties).toEqual(['name']);
}

function rejectInvalidActionContainer({ actions }: { actions: unknown }) {
  expect(pkit.module('portals').registerActions.bind(null, actions as never)).toThrow(/registerActions espera un objeto/);
}

test('los builders conservan identidad, alcance y métodos extraídos', preserveBuilderBindings);

function preserveBuilderBindings(): void {
  pkit.context.set('roles', ['staff']);
  const portals = pkit.module('portals');
  const staff = portals.role('staff');
  const { registerActions, hook } = staff;
  expect(registerActions({ find: { enabled: true, properties: ['id'] } })).toBe(staff);
  expect(hook('find', allowHook)).toBe(staff);
  expect(portals.hook('find', allowHook)).toBe(portals);
  expect(Object.keys(staff).sort()).toEqual(['hook', 'registerActions']);
  const { module: defineChild } = portals;
  defineChild('reports').registerActions({ find: { enabled: true, properties: ['name'] } });
  pkit.seal();
  expect(pkit.permissions.forRole('staff')['portals.find']).toBe(true);
  expect(pkit.permissions.forRole()['portals.find']).toBe(false);
  expect(pkit.permissions.forRole()['portals.reports.find']).toBe(true);
}

test.each([{ roles: null }, { roles: undefined }, { roles: [''] }, { roles: [1] }, { roles: Array(1) }])(
  'un catálogo inválido %j falla sin sustituir sus roles', rejectInvalidRoleCatalog,
);

function rejectInvalidRoleCatalog({ roles }: { roles: unknown }): void {
  expect(pkit.context.set.bind(null, 'roles', roles as never)).toThrow(/strings no vacíos/);
  expect(pkit.context.get('roles')).toEqual(['general']);
}
