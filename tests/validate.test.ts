import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { setTimeout as delay } from 'node:timers/promises';
import type { Context, Data, ResolvedPermission } from '../src/types';
import { ADMIN_REPORTS, ADMIN_ITEMS_ALL, STAFF_REPORTS, STAFF_ITEMS_ALL, STAFF_ITEMS_UPDATE_ONLY, resetState, setupInventory } from './helpers';

beforeEach(resetState);

const action = 'inventory.items';
const staffReports = { action, name: 'all', role: 'staff', permissions: [STAFF_REPORTS] } as const;
const adminReports = { action, name: 'all', role: 'admin', permissions: [ADMIN_REPORTS] } as const;
const staffItems = { action, name: 'all', role: 'staff', permissions: [STAFF_ITEMS_ALL] } as const;
const adminItems = { action, name: 'all', role: 'admin', permissions: [ADMIN_ITEMS_ALL] } as const;
const SOURCE = 'staff::source::all';
const OTHER = 'staff::other::all';
const targetRequest = { action: 'target', name: 'all', role: 'staff', method: 'find' } as const;

function errorCodes(validation: { errors: readonly { code: string }[] }): string[] {
  const codes: string[] = [];
  for (const error of validation.errors) codes.push(error.code);

  return codes;
}

function setupGraph() {
  pkit.context.set('roles', ['staff']);

  return {
    target: pkit.module('target').name('all'),
    source: pkit.module('source').name('all'),
    other: pkit.module('other').name('all'),
  };
}

test('validate antes de seal() devuelve NOT_SEALED', rejectOpenRegistry);
test('orden de corte: entrada → rol → asignaciones → módulo y nombre → asignación → método', preserveDenialOrder);
test('una concesión entrega exactamente sus campos, sin heredar el comodín de la definición directa', useGrantFields);
test('la asignación directa manda sobre la concesión aunque sea más estrecha', preferDirectAssignment);
test('varias concesiones al mismo destino unen sus campos y los hooks corren una vez', uniteGrants);
test('una concesión solo habilita los métodos que declara; la asignación directa habilita los suyos', grantDeclaredMethodsOnly);
test('nombres distintos no se unen', keepNamesIndependent);
test('lista vacía deniega; identificadores repetidos no duplican hooks', denyEmptyAndDeduplicate);
test('una definición directa asignada y deshabilitada deniega aunque exista concesión; sin asignar no participa', preferDirectDenial);
test('el origen concede aunque todos sus métodos estén deshabilitados', grantFromDisabledSource);
test('las concesiones son de un salto', stopAtOneHop);
test('hooks: módulo → nombre → rol efectivo, en acceso directo y derivado; nunca de otro nombre ni del permiso habilitante', runHooksInOrder);
test('los hooks reciben el destino efectivo y el origen de la autorización', passAuthorizationMetadata);
test('hooks simultáneos conservan todos los fallos y su orden de registro', collectOrderedHookFailures);
test('find: select se recorta a properties; sin select, select = properties', selectAllowedFields);
test("find con properties '*': result = select o '*'", selectWildcardFields);
test('escritura: campo fuera de properties deniega y lista los campos', rejectForbiddenFields);
test('escritura válida devuelve la data con su tipo; con * acepta cualquier campo', preserveWriteData);
test('select fuera de find es error de programación', rejectWriteSelection);
test.each([{ data: null }, { data: false }, { data: 1 }, { data: 'invalid' }, { data: [] }])('data inválida %j falla incluso con properties comodín', rejectInvalidData);
test.each([{ context: null }, { context: false }, { context: 1 }, { context: 'invalid' }, { context: [] }])('context inválido %j no se sustituye por un objeto vacío', rejectInvalidContext);
test.each([{ select: null }, { select: 'id' }, { select: [1] }])('select inválido %j no omite la evaluación de campos', rejectInvalidSelection);
test('escritura sin data falla sin fabricar un objeto vacío', rejectMissingWriteData);
test('los fallos inesperados conservan su causa dentro de validate', preserveUnexpectedCause);
test('los campos denegados impiden ejecutar hooks', stopHooksOnFieldDenial);
test('los hooks reciben los datos opcionales ausentes sin sustituirlos', preserveMissingHookArguments);
test('un hook síncrono fallido no impide ejecutar los siguientes', continueAfterSynchronousFailure);
test('la petición usa la misma data para campos, hooks y resultado', readWriteDataOnce);

function recordHook(executedHooks: string[], label: string): void {
  executedHooks.push(label);
}

function capturePermission(permissions: ResolvedPermission[], _data: Data | undefined, _context: Context | undefined, permission: ResolvedPermission): void {
  permissions.push(permission);
}

function throwHookFailure(cause: unknown): never {
  throw cause;
}

function checkPublication(executedHooks: string[], data: Data | undefined): void {
  executedHooks.push('module');
  if (data!.status === 'published') throw new Error('published');
}

function checkOwner(executedHooks: string[], data: Data | undefined, context: Context | undefined): void {
  executedHooks.push('staff');
  if (data!.owner !== (context!.user as { id: number }).id) throw new Error('not owner');
}

async function failRecordedHook(completionOrder: string[], failure: { label: string; cause: unknown; delay: number }): Promise<never> {
  if (failure.delay > 0) await delay(failure.delay);
  completionOrder.push(failure.label);
  throw failure.cause;
}

function expectMissingArguments(data: Data | undefined, context: Context | undefined): void {
  expect(data).toBeUndefined();
  expect(context).toBeUndefined();
}

function readRecordedData(reads: number[], data: Data): Data {
  reads.push(1);
  return data;
}

async function rejectOpenRegistry() {
  setupInventory();

  expect(await pkit.validate({ ...staffReports, method: 'find' })).toEqual({
    result: null, errors: [{ code: 'NOT_SEALED', message: expect.stringMatching(/falta pkit.seal\(\)/) }],
  });
}

async function preserveDenialOrder() {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
  expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', role: 'staff' } as never))).toEqual(['INVALID_INPUT']);
  expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'staff', permissions: [] } as never))).toEqual(['INVALID_INPUT']);
  expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', role: 'nobody' as never }))).toEqual(['UNKNOWN_ROLE']);
  expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['staff::x'] }))).toEqual(['INVALID_INPUT']);
  expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find', permissions: [ADMIN_REPORTS] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
  expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_REPORTS, 'staff::inventory.items::old'] }))).toEqual(['UNKNOWN_PERMISSION']);
  expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: ['admin::inventory.items::update-only'] }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
  expect(errorCodes(await pkit.validate({ ...staffReports, action: 'x.y', method: 'find' }))).toEqual(['UNKNOWN_ACTION']);
  expect(errorCodes(await pkit.validate({ ...staffReports, name: 'missing', method: 'find' }))).toEqual(['UNKNOWN_PERMISSION']);
  expect(errorCodes(await pkit.validate({ ...adminReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
  expect(errorCodes(await pkit.validate({ ...staffReports, name: 'update-only', method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
  expect(errorCodes(await pkit.validate({ ...staffItems, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
  expect(errorCodes(await pkit.validate({ action, name: 'all', method: 'find', role: 'public', permissions: ['public::inventory.items::all'] }))).toEqual(['METHOD_DISABLED']);
}

async function useGrantFields() {
  setupInventory();
  pkit.seal();

  expect(await pkit.validate({ ...adminReports, method: 'find' })).toEqual({ result: ['id', 'name', 'assetId'], errors: [] });
  expect((await pkit.validate({ ...adminReports, method: 'find', select: ['id', 'internalNotes'] })).result).toEqual(['id']);
  expect((await pkit.validate({ ...adminReports, name: 'update-only', method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
  expect((await pkit.validate({ ...staffReports, method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
}

async function preferDirectAssignment() {
  setupInventory();
  pkit.seal();

  expect((await pkit.validate({ ...adminReports, method: 'find', permissions: [ADMIN_REPORTS, ADMIN_ITEMS_ALL] })).result).toBe('*');

  resetState();
  const { target, source } = setupGraph();
  target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
  pkit.seal();

  expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id', 'name']);
  expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE, 'staff::target::all'] })).result).toEqual(['id']);
}

async function uniteGrants() {
  const { target, source, other } = setupGraph();
  const executedHooks: string[] = [];
  const capturedPermissions: ResolvedPermission[] = [];
  target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  other.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  target.grantTo(OTHER).registerActions({ find: { enabled: true, properties: ['name', 'extra'] } });
  target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
  target.hook('find', recordHook.bind(null, executedHooks, 'name'));
  target.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
  target.role('staff').hook('find', capturePermission.bind(null, capturedPermissions));
  pkit.seal();

  const validation = await pkit.validate({ ...targetRequest, permissions: [OTHER, SOURCE] });

  expect(validation).toEqual({ result: ['name', 'extra', 'id'], errors: [] });
  expect(executedHooks).toEqual(['name', 'staff']);
  expect(capturedPermissions[0]?.authorization).toEqual({ direct: false, grantedBy: [OTHER, SOURCE] });

}

async function grantDeclaredMethodsOnly() {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...staffReports, name: 'update-only', method: 'update', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);

  const data = { id: 1, name: 'Item' };
  const validation = await pkit.validate({ action, name: 'update-only', method: 'update', role: 'staff', permissions: [STAFF_ITEMS_UPDATE_ONLY], data });

  expect(validation).toEqual({ result: data, errors: [] });
}

async function keepNamesIndependent() {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...staffItems, name: 'update-only', method: 'find' }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
  expect(errorCodes(await pkit.validate({ ...staffItems, method: 'find', permissions: [STAFF_ITEMS_UPDATE_ONLY] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
}

async function denyEmptyAndDeduplicate() {
  const { itemsAll } = setupInventory();
  const executedHooks: string[] = [];
  itemsAll.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...staffReports, method: 'find', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);

  const validation = await pkit.validate({ ...staffReports, method: 'find', permissions: [STAFF_REPORTS, STAFF_REPORTS] });

  expect(validation.result).toEqual(['id', 'name', 'assetId']);
  expect(executedHooks).toEqual(['staff']);
}

async function preferDirectDenial() {
  const { target, source } = setupGraph();
  target.role('staff').registerActions({ find: { enabled: false, properties: ['id'] } });
  source.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...targetRequest, permissions: [SOURCE, 'staff::target::all'] }))).toEqual(['METHOD_DISABLED']);
  expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id']);
}

async function grantFromDisabledSource() {
  const { target, source } = setupGraph();
  target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  source.role('staff').registerActions({ find: { enabled: false, properties: [] } });
  target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
  pkit.seal();

  expect((await pkit.validate({ ...targetRequest, permissions: [SOURCE] })).result).toEqual(['id']);
  expect(errorCodes(await pkit.validate({ ...targetRequest, action: 'source', permissions: [SOURCE] }))).toEqual(['METHOD_DISABLED']);
}

async function stopAtOneHop() {
  const { target, source, other } = setupGraph();
  target.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  source.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  other.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });
  target.grantTo(SOURCE).registerActions({ find: { enabled: true, properties: ['id'] } });
  source.grantTo(OTHER).registerActions({ find: { enabled: true, properties: ['id'] } });
  pkit.seal();

  expect((await pkit.validate({ ...targetRequest, action: 'source', permissions: [OTHER] })).result).toEqual(['id']);
  expect(errorCodes(await pkit.validate({ ...targetRequest, permissions: [OTHER] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
}

async function runHooksInOrder() {
  const { items, itemsAll, itemsUpdateOnly, reports } = setupInventory();
  const executedHooks: string[] = [];
  items.hook('find', recordHook.bind(null, executedHooks, 'module'));
  itemsAll.hook('find', recordHook.bind(null, executedHooks, 'name'));
  itemsAll.role('staff').hook('find', recordHook.bind(null, executedHooks, 'staff'));
  itemsAll.role('admin').hook('find', recordHook.bind(null, executedHooks, 'admin'));
  itemsUpdateOnly.hook('find', recordHook.bind(null, executedHooks, 'update-only'));
  reports.hook('find', recordHook.bind(null, executedHooks, 'reports'));
  reports.role('staff').hook('find', recordHook.bind(null, executedHooks, 'reports:staff'));
  items.hook('update', checkPublication.bind(null, executedHooks));
  itemsAll.role('staff').hook('update', checkOwner.bind(null, executedHooks));
  pkit.seal();

  expect((await pkit.validate({ ...staffReports, method: 'find' })).errors).toEqual([]);
  expect(executedHooks).toEqual(['module', 'name', 'staff']);

  executedHooks.length = 0;
  expect((await pkit.validate({ ...adminItems, method: 'find' })).errors).toEqual([]);
  expect(executedHooks).toEqual(['module', 'name', 'admin']);

  executedHooks.length = 0;
  const adminUpdate = await pkit.validate({ ...adminItems, method: 'update', data: { status: 'published', owner: 2 }, context: { user: { id: 1 } } });
  expect(executedHooks).toEqual(['module']);
  expect(adminUpdate.errors).toEqual([{ code: 'HOOK_ERROR', message: 'published', cause: expect.any(Error) }]);

  executedHooks.length = 0;
  const staffUpdate = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x' }, context: { user: { id: 1 }, resource: { owner: 2 } } });
  expect(executedHooks).toEqual(['module', 'staff']);
  expect(staffUpdate.errors).toEqual([{ code: 'HOOK_ERROR', message: 'not owner', cause: expect.any(Error) }]);
}

async function passAuthorizationMetadata() {
  const { itemsAll } = setupInventory();
  const capturedPermissions: ResolvedPermission[] = [];
  itemsAll.role('staff').hook('find', capturePermission.bind(null, capturedPermissions));
  pkit.seal();

  await pkit.validate({ ...staffReports, method: 'find' });
  await pkit.validate({ ...staffItems, method: 'find', permissions: [STAFF_ITEMS_ALL, STAFF_REPORTS] });

  expect(capturedPermissions[0]).toEqual({
    role: 'staff',
    action,
    name: 'all',
    permissionId: STAFF_ITEMS_ALL,
    method: 'find',
    enabled: true,
    properties: ['id', 'name', 'assetId'],
    authorization: { direct: false, grantedBy: [STAFF_REPORTS] },
  });
  expect(capturedPermissions[1]?.authorization).toEqual({ direct: true, grantedBy: [] });
  expect(Object.isFrozen(capturedPermissions[0])).toBe(true);
  expect(Object.isFrozen(capturedPermissions[0]?.authorization)).toBe(true);
  expect(Object.isFrozen(capturedPermissions[0]?.authorization.grantedBy)).toBe(true);
}

async function collectOrderedHookFailures() {
  const { items, itemsAll } = setupInventory();
  const firstFailure = new Error('first failure');
  const laterFailure = { reason: 'later failure' };
  const completionOrder: string[] = [];
  items.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'first', cause: firstFailure, delay: 10 }));
  itemsAll.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'second', cause: 'second failure', delay: 0 }));
  itemsAll.role('staff').hook('find', failRecordedHook.bind(null, completionOrder, { label: 'staff', cause: laterFailure, delay: 0 }));
  pkit.seal();

  const validation = await pkit.validate({ ...staffReports, method: 'find' });

  expect(completionOrder).toEqual(['second', 'staff', 'first']);
  expect(validation).toEqual({ result: null, errors: [
    { code: 'HOOK_ERROR', message: 'first failure', cause: firstFailure },
    { code: 'HOOK_ERROR', message: 'second failure', cause: 'second failure' },
    { code: 'HOOK_ERROR', message: '[object Object]', cause: laterFailure },
  ] });
  expect(Object.isFrozen(validation.errors)).toBe(true);
}

async function selectAllowedFields() {
  setupInventory();
  pkit.seal();

  expect(await pkit.validate({ ...staffItems, method: 'find', select: ['id', 'owner'] })).toEqual({ result: ['id'], errors: [] });
  expect((await pkit.validate({ ...staffItems, method: 'find' })).result).toEqual(['id', 'name', 'assetId']);
}

async function selectWildcardFields() {
  setupInventory();
  pkit.seal();

  expect((await pkit.validate({ ...adminItems, method: 'find' })).result).toBe('*');
  expect((await pkit.validate({ ...adminItems, method: 'find', select: ['owner'] })).result).toEqual(['owner']);
}

async function rejectForbiddenFields() {
  setupInventory();
  pkit.seal();

  const validation = await pkit.validate({ ...staffItems, method: 'update', data: { id: 1, name: 'x', owner: 2, status: 'draft' } });

  expect(validation.result).toBeNull();
  expect(validation.errors).toEqual([
    { code: 'PROPERTIES_NOT_ALLOWED', message: expect.stringMatching(/owner, status$/), fields: ['owner', 'status'] },
  ]);
}

async function preserveWriteData() {
  setupInventory();
  pkit.seal();
  const data = { id: 1, name: 'x' };
  const validation = await pkit.validate({ ...staffItems, method: 'update', data });

  expect(validation.result).toBe(data);
  expect(validation.result?.id).toBe(1);
  expect((await pkit.validate({ ...adminItems, method: 'update', data: { owner: 9 } })).errors).toEqual([]);
}

async function rejectWriteSelection() {
  setupInventory();
  pkit.seal();

  expect(await pkit.validate({ ...adminItems, method: 'update', select: ['id'] } as never)).toEqual({
    result: null, errors: [{ code: 'INVALID_INPUT', message: 'select solo aplica en find' }],
  });
}

async function rejectInvalidData({ data }: { data: unknown }) {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...adminItems, method: 'update', data } as never))).toEqual(['INVALID_INPUT']);
}

async function rejectInvalidContext({ context }: { context: unknown }) {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...adminItems, method: 'find', context } as never))).toEqual(['INVALID_INPUT']);
}

async function rejectInvalidSelection({ select }: { select: unknown }) {
  setupInventory();
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...adminItems, method: 'find', select } as never))).toEqual(['INVALID_INPUT']);
  expect(errorCodes(await pkit.validate({ ...staffItems, method: 'find', select } as never))).toEqual(['INVALID_INPUT']);
}

async function rejectMissingWriteData(): Promise<void> {
  setupInventory();
  pkit.seal();

  expect(await pkit.validate({ ...adminItems, method: 'update' } as never)).toEqual({
    result: null, errors: [{ code: 'INVALID_INPUT', message: 'data debe ser un objeto' }],
  });
}

async function preserveUnexpectedCause() {
  setupInventory();
  pkit.seal();
  const failure = new Error('broken request data');
  const input = Object.defineProperty({ ...staffItems, method: 'find' as const }, 'data', { get: throwHookFailure.bind(null, failure) });

  expect(await pkit.validate(input)).toEqual({ result: null, errors: [
    { code: 'VALIDATION_ERROR', message: 'no se pudo validar el permiso', cause: failure },
  ] });
}

async function stopHooksOnFieldDenial() {
  const { items } = setupInventory();
  const executedHooks: string[] = [];
  items.hook('update', recordHook.bind(null, executedHooks, 'update'));
  pkit.seal();

  expect(errorCodes(await pkit.validate({ ...staffItems, method: 'update', data: { owner: 1 } }))).toEqual(['PROPERTIES_NOT_ALLOWED']);
  expect(executedHooks).toEqual([]);
}

async function preserveMissingHookArguments(): Promise<void> {
  const { items } = setupInventory();
  items.hook('find', expectMissingArguments);
  pkit.seal();

  expect((await pkit.validate({ ...staffReports, method: 'find' })).errors).toEqual([]);
}

async function continueAfterSynchronousFailure(): Promise<void> {
  const { items } = setupInventory();
  const executedHooks: string[] = [];
  items.hook('find', throwHookFailure.bind(null, 'synchronous failure'));
  items.hook('find', recordHook.bind(null, executedHooks, 'next'));
  pkit.seal();

  expect(await pkit.validate({ ...staffReports, method: 'find' })).toEqual({
    result: null, errors: [{ code: 'HOOK_ERROR', message: 'synchronous failure', cause: 'synchronous failure' }],
  });
  expect(executedHooks).toEqual(['next']);
}

async function readWriteDataOnce(): Promise<void> {
  setupInventory();
  pkit.seal();
  const data = { id: 1 };
  const reads: number[] = [];
  const input = { ...staffItems, method: 'update' as const, data };
  Object.defineProperty(input, 'data', { get: readRecordedData.bind(null, reads, data) });

  expect(await pkit.validate(input)).toEqual({ result: data, errors: [] });
  expect(reads).toEqual([1]);
}
