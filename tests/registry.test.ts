import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { ADMIN_REPORTS, STAFF_REPORTS, allowHook, resetState, setupInventory } from './helpers';

beforeEach(resetState);

const findId = { find: { enabled: true, properties: ['id'] } } as const;

test('rol no declarado lanza con la pista de pkit.config.js', rejectUndeclaredRole);
test('el catálogo contiene exactamente los roles declarados, sin general implícito', declareExactCatalog);
test('sin catálogo declarado el único rol es general y debe escribirse explícito', useGeneralWithoutCatalog);
test('roles se declaran antes del primer registro', rejectLateCatalog);
test('mismo (módulo, nombre, rol) dos veces lanza DUPLICATE_REGISTRATION; otro nombre no', rejectDuplicateActions);
test('misma concesión dos veces lanza DUPLICATE_REGISTRATION', rejectDuplicateGrant);
test('literal inválido lanza INVALID_DEFINITION', rejectInvalidActions);
test.each(['a.b', 'a:b', ' a', 'a ', '', 3])('segmento de módulo inválido %j lanza INVALID_DEFINITION', rejectInvalidModuleName);
test.each(['*', 'a:b', ' x', 'x ', '', 3])('nombre de permiso inválido %j lanza INVALID_DEFINITION', rejectInvalidPermissionName);
test.each(['staff::x', 'staff::inventory.items::', 'staff:: x::y', 'staff::a..b::y', '*::x::y', 'staff::x::*', 'staff:::x::y'])(
  'identificador de grantTo inválido %j lanza INVALID_DEFINITION', rejectMalformedGrantId,
);
test('una concesión rechaza enabled: false, comodín, rol no declarado y autorreferencia', rejectInvalidGrant);
test('seal() rechaza nombres sin acciones aunque tengan hooks o concesiones', rejectNamesWithoutActions);
test('seal() rechaza concesiones cuyo origen o método no existe', rejectDanglingGrant);
test('seal() rechaza hook de rol sin definición directa ni concesión para ese rol', rejectOrphanHook);
test('seal() acepta hook de rol cuyo único camino es una concesión y concesiones mutuas', acceptGrantPaths);
test('tras seal() todo registro lanza SEALED y seal() es idempotente', closeRegistration);
test('el registro copia y congela las definiciones', freezeDefinitions);
test('un registro inválido no crea módulos ni bloquea el catálogo de roles', avoidFailedRegistrationMutation);
test('un literal con varios métodos se registra completo o no se registra', registerActionsAtomically);
test.each([{ actions: null }, { actions: undefined }, { actions: [] }, { actions: false }])('registerActions rechaza el literal %j', rejectInvalidActionContainer);
test('los builders conservan identidad, alcance y métodos extraídos', preserveBuilderBindings);
test.each([{ roles: null }, { roles: undefined }, { roles: [''] }, { roles: [1] }, { roles: Array(1) }])(
  'un catálogo inválido %j falla sin sustituir sus roles', rejectInvalidRoleCatalog,
);
test('el marcador de hooks globales no puede declararse como rol', rejectGlobalHookOwnerRole);

function rejectUndeclaredRole() {
  const admin = pkit.module('items').name('all').role('admin');

  expect(admin.registerActions.bind(null, findId)).toThrow(/role "admin" no está declarado\. Roles disponibles: general\./);
  expect(admin.hook.bind(null, 'find', allowHook)).toThrow(/role "admin" no está declarado/);
  expect(admin.registerActions.bind(null, findId)).toThrow(expect.objectContaining({ code: 'ROLE_NOT_DECLARED', name: 'PkitError' }));
}

function declareExactCatalog() {
  pkit.context.set('roles', ['admin']);

  expect(pkit.context.get('roles')).toEqual(['admin']);
  expect(pkit.module('items').name('all').role('general').registerActions.bind(null, findId)).toThrow(/role "general" no está declarado/);
}

function useGeneralWithoutCatalog() {
  const items = pkit.module('items').name('all');

  expect(pkit.context.get('roles')).toEqual(['general']);
  expect(items.role('general').registerActions(findId)).toBeDefined();
  expect(items.role('staff').registerActions.bind(null, findId)).toThrow(/role "staff" no está declarado/);
}

function rejectLateCatalog() {
  pkit.module('items').name('all').role('general').registerActions(findId);

  expect(pkit.context.set.bind(null, 'roles', ['admin'])).toThrow(/antes de registrar/);
}

function rejectDuplicateActions() {
  const items = pkit.module('items');
  items.name('all').role('general').registerActions(findId);

  expect(items.name('all').role('general').registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(/ya tiene acciones/);
  expect(items.name('other').role('general').registerActions(findId)).toBeDefined();
}

function rejectDuplicateGrant() {
  const { itemsAll } = setupInventory();

  expect(itemsAll.grantTo(ADMIN_REPORTS).registerActions.bind(null, { update: { enabled: true, properties: [] } })).toThrow(/ya tiene una concesión/);
}

function rejectInvalidActions() {
  const general = pkit.module('items').name('all').role('general');

  expect(general.registerActions.bind(null, { list: { properties: [], enabled: true } } as never)).toThrow(/método "list" no existe/);
  expect(general.registerActions.bind(null, { find: { properties: 'all', enabled: true } } as never)).toThrow(/string\[\] o '\*'/);
  expect(general.registerActions.bind(null, { find: { properties: [] } } as never)).toThrow(/enabled debe ser boolean/);
}

function rejectInvalidModuleName(segment: unknown) {
  expect(pkit.module.bind(null, segment as never)).toThrow(/nombre de módulo inválido/);
  expect(pkit.module('items').module.bind(null, segment as never)).toThrow(/nombre de módulo inválido/);
}

function rejectInvalidPermissionName(name: unknown) {
  expect(pkit.module('items').name.bind(null, name as never)).toThrow(/nombre de permiso inválido/);
}

function rejectMalformedGrantId(permissionId: string) {
  pkit.context.set('roles', ['staff']);

  expect(pkit.module('items').name('all').grantTo(permissionId as never).registerActions.bind(null, findId)).toThrow(/identificador de grantTo inválido/);
}

function rejectInvalidGrant() {
  pkit.context.set('roles', ['staff']);
  const items = pkit.module('items').name('all');

  expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: false, properties: [] } } as never)).toThrow(/no admite enabled: false/);
  expect(items.grantTo('staff::reports::all').registerActions.bind(null, { find: { enabled: true, properties: '*' } } as never)).toThrow(/lista explícita de properties/);
  expect(items.grantTo('admin::reports::all' as never).registerActions.bind(null, findId)).toThrow(/role "admin" no está declarado/);
  expect(items.grantTo('staff::items::all').registerActions.bind(null, findId)).toThrow(/no puede concederse a sí mismo/);
}

function rejectNamesWithoutActions() {
  pkit.context.set('roles', ['staff']);
  pkit.module('items').name('all').hook('find', allowHook);

  expect(pkit.seal.bind(null)).toThrow(/"items::all" no tiene acciones registradas/);

  resetState();
  pkit.context.set('roles', ['staff']);
  pkit.module('reports').name('all').role('staff').registerActions(findId);
  pkit.module('items').name('all').grantTo('staff::reports::all').registerActions(findId);

  expect(pkit.seal.bind(null)).toThrow(/"items::all" no tiene acciones registradas/);
}

function rejectDanglingGrant() {
  pkit.context.set('roles', ['staff', 'admin']);
  const items = pkit.module('items').name('all');
  items.role('staff').registerActions(findId);
  items.grantTo('staff::reports::all').registerActions(findId);

  expect(pkit.seal.bind(null)).toThrow(/grantTo "staff::reports::all" referencia un permiso sin acciones registradas/);

  pkit.module('reports').name('all').role('admin').registerActions(findId);

  expect(pkit.seal.bind(null)).toThrow(/grantTo "staff::reports::all" referencia un permiso sin acciones registradas/);

  pkit.module('reports').name('all').role('staff').registerActions(findId);
  items.grantTo('admin::reports::all').registerActions({ remove: { enabled: true, properties: ['id'] } });

  expect(pkit.seal.bind(null)).toThrow(/grantTo "admin::reports::all" concede "remove", que ningún rol declara/);
}

function rejectOrphanHook() {
  setupInventory().itemsUpdateOnly.role('public').hook('find', allowHook);

  expect(pkit.seal.bind(null)).toThrow(/hook de "public" en "find" sin acciones registradas ni concesión/);
}

function acceptGrantPaths() {
  const { itemsUpdateOnly, reports } = setupInventory();
  itemsUpdateOnly.role('admin').hook('find', allowHook);
  reports.grantTo('staff::inventory.items::all').registerActions(findId);
  pkit.seal();

  expect(pkit.permissions.named[STAFF_REPORTS]).toBeDefined();
}

function closeRegistration() {
  const { items, itemsAll } = setupInventory();
  pkit.seal();
  pkit.seal();

  expect(itemsAll.role('public').registerActions.bind(null, findId)).toThrow(/ya fue llamado/);
  expect(itemsAll.grantTo(STAFF_REPORTS).registerActions.bind(null, findId)).toThrow(/ya fue llamado/);
  expect(itemsAll.hook.bind(null, 'find', allowHook)).toThrow(/ya fue llamado/);
  expect(items.hook.bind(null, 'find', allowHook)).toThrow(/ya fue llamado/);
  expect(pkit.context.set.bind(null, 'roles', ['x'])).toThrow(/ya fue llamado/);
}

function freezeDefinitions() {
  const properties = ['id'];
  pkit.module('items').name('all').role('general').registerActions({ find: { properties, enabled: true } });
  properties.push('secret');
  pkit.seal();

  expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['id']);
}

function avoidFailedRegistrationMutation() {
  expect(pkit.module('items').name('all').role('general').registerActions.bind(null, { find: { enabled: 'yes', properties: [] } } as never)).toThrow();

  pkit.context.set('roles', ['staff']);

  expect(pkit.context.get('roles')).toEqual(['staff']);

  pkit.seal();

  expect(pkit.permissions.named).toEqual({});
}

function registerActionsAtomically() {
  const general = pkit.module('items').name('all').role('general');

  expect(general.registerActions.bind(null, {
    find: { enabled: true, properties: ['id'] },
    update: { enabled: true, properties: null },
  } as never)).toThrow();

  general.registerActions({ find: { enabled: true, properties: ['name'] } });
  pkit.seal();

  expect(pkit.permissions.named['general::items::all']?.find?.properties).toEqual(['name']);
}

function rejectInvalidActionContainer({ actions }: { actions: unknown }) {
  expect(pkit.module('items').name('all').role('general').registerActions.bind(null, actions as never)).toThrow(/registerActions espera un objeto/);
}

function preserveBuilderBindings(): void {
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
}

function rejectInvalidRoleCatalog({ roles }: { roles: unknown }): void {
  expect(pkit.context.set.bind(null, 'roles', roles as never)).toThrow(/strings no vacíos/);
  expect(pkit.context.get('roles')).toEqual(['general']);
}

function rejectGlobalHookOwnerRole(): void {
  expect(pkit.context.set.bind(null, 'roles', ['staff', '*'])).toThrow(/reservado para los hooks globales/);
  expect(pkit.context.get('roles')).toEqual(['general']);
}
