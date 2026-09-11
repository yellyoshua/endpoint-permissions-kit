import { beforeEach, expect, test } from 'bun:test';
import pkit from '../src/index';
import { setTimeout as delay } from 'node:timers/promises';
import type { Context, Data, ResolvedPermission } from '../src/types';
import { resetState, setupPortals } from './helpers';
beforeEach(resetState);
const action = 'marketing.portals';

function errorCodes(validation: {
  errors: readonly {
    code: string;
  }[];
}): string[] {
  const codes: string[] = [];
  for (const error of validation.errors)
    codes.push(error.code);
  return codes;
}
test('validate antes de seal() devuelve NOT_SEALED', rejectOpenRegistry);
test('orden de corte: rol → permiso → método', preserveDenialOrder);
test('find: select se recorta a properties; sin select, select = properties', selectAllowedFields);
test("find con properties '*': result = select o '*'", selectWildcardFields);
test('escritura: campo fuera de properties deniega y lista los campos', rejectForbiddenFields);
test('escritura válida devuelve la data con su tipo; con * acepta cualquier campo', preserveWriteData);
test('select fuera de find es error de programación', rejectWriteSelection);
test('hooks: globales + del rol, todos corren, se recogen todos los fallos', runGlobalAndRoleHooks);
test('hooks reciben el permiso resuelto y no corren si el método está deshabilitado', passResolvedPermission);
test('sin catálogo ni rol explícito valida los permisos de general y sus hooks', useGeneralRole);
test('un rol explícito desconocido no obtiene los permisos de general', rejectUnknownRole);
test('un método deshabilitado por el rol prevalece sobre general', preserveExplicitDenial);
test('hooks simultáneos conservan todos los fallos y su orden de registro', collectOrderedHookFailures);
test.each([{ data: null }, { data: false }, { data: 1 }, { data: 'invalid' }, { data: [] }])('data inválida %j falla incluso con properties comodín', rejectInvalidData);
test.each([{ context: null }, { context: false }, { context: 1 }, { context: 'invalid' }, { context: [] }])('context inválido %j no se sustituye por un objeto vacío', rejectInvalidContext);
test.each([{ select: null }, { select: 'id' }, { select: [1] }])('select inválido %j no omite la evaluación de campos', rejectInvalidSelection);
test('los fallos inesperados conservan su causa dentro de validate', preserveUnexpectedCause);
test('los campos denegados impiden ejecutar hooks', stopHooksOnFieldDenial);

function checkPublication(executedHooks: string[], data: Data | undefined): void {
  executedHooks.push('global');
  if (data!.status === 'published')
    throw new Error('published');
}

function checkOwner(executedHooks: string[], data: Data | undefined, context: Context | undefined): void {
  executedHooks.push('staff');
  if (data!.owner !== (context!.user as {
    id: number;
  }).id)
    throw new Error('not owner');
}

function recordHook(executedHooks: string[], label: string): void {
  executedHooks.push(label);
}

function capturePermission(permissions: ResolvedPermission[], _data: Data | undefined, _context: Context | undefined, permission: ResolvedPermission): void {
  permissions.push(permission);
}

function throwHookFailure(cause: unknown): never {
  throw cause;
}

function recordPermissionRole(executedHooks: string[], _data: Data | undefined, _context: Context | undefined, permission: ResolvedPermission): void {
  executedHooks.push(`global:${permission.role}`);
}

async function failRecordedHook(completionOrder: string[], failure: {
  label: string;
  cause: unknown;
  delay: number;
}): Promise<never> {
  if (failure.delay > 0)
    await delay(failure.delay);
  completionOrder.push(failure.label);
  throw failure.cause;
}

async function rejectOpenRegistry() {
  setupPortals();
  expect(await pkit.validate({ action, method: 'find', role: 'staff' })).toEqual({
    result: null, errors: [{ code: 'NOT_SEALED', message: expect.stringMatching(/falta pkit.seal\(\)/) }],
  });
}

async function preserveDenialOrder() {
  setupPortals();
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'nobody' as never }))).toEqual(['UNKNOWN_ROLE']);
  expect(errorCodes(await pkit.validate({ action: 'x.y', method: 'find', role: 'staff' }))).toEqual(['UNKNOWN_ACTION']);
  expect(errorCodes(await pkit.validate({ action, method: 'remove', role: 'staff', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
  expect(errorCodes(await pkit.validate({ action, method: 'update', role: 'public', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
}

async function selectAllowedFields() {
  setupPortals();
  pkit.seal();
  const inheritedValidation = await pkit.validate({ action, method: 'find', role: 'staff', select: ['id', 'owner'] });
  expect(inheritedValidation).toEqual({ result: ['id'], errors: [] });
  const defaultValidation = await pkit.validate({ action, method: 'find', role: 'public' });
  expect(defaultValidation.result).toEqual(['id', 'name', 'link']);
}

async function selectWildcardFields() {
  setupPortals();
  pkit.seal();
  expect((await pkit.validate({ action, method: 'find', role: 'admin' })).result).toBe('*');
  expect((await pkit.validate({ action, method: 'find', role: 'admin', select: ['owner'] })).result).toEqual(['owner']);
}

async function rejectForbiddenFields() {
  setupPortals();
  pkit.seal();
  const validation = await pkit.validate({
    action,
    method: 'update',
    role: 'staff',
    data: { id: 1, name: 'x', owner: 2, status: 'draft' },
  });
  expect(validation.result).toBeNull();
  expect(validation.errors).toEqual([
    { code: 'PROPERTIES_NOT_ALLOWED', message: expect.stringMatching(/owner, status$/), fields: ['owner', 'status'] },
  ]);
}

async function preserveWriteData() {
  setupPortals();
  pkit.seal();
  const data = { id: 1, name: 'x' };
  const validation = await pkit.validate({ action, method: 'update', role: 'staff', data });
  expect(validation.result).toBe(data);
  expect(validation.result?.id).toBe(1);
  expect((await pkit.validate({ action, method: 'update', role: 'admin', data: { owner: 9 } })).errors).toEqual([]);
}

async function rejectWriteSelection() {
  setupPortals();
  pkit.seal();
  expect(await pkit.validate({ action, method: 'update', role: 'admin', select: ['id'] } as never)).toEqual({
    result: null, errors: [{ code: 'INVALID_INPUT', message: 'select solo aplica en find' }],
  });
}

async function runGlobalAndRoleHooks() {
  const portals = setupPortals();
  const executedHooks: string[] = [];
  portals.hook('update', checkPublication.bind(null, executedHooks));
  portals.role('staff').hook('update', checkOwner.bind(null, executedHooks));
  portals.role('general').hook('update', recordHook.bind(null, executedHooks, 'general'));
  pkit.seal();
  const validation = await pkit.validate({
    action,
    method: 'update',
    role: 'admin',
    data: { status: 'published', owner: 2 },
    context: { user: { id: 1 } },
  });
  expect(executedHooks).toEqual(['global']);
  expect(validation.errors).toEqual([{ code: 'HOOK_ERROR', message: 'published', cause: expect.any(Error) }]);
  executedHooks.length = 0;
  const staff = await pkit.validate({
    action,
    method: 'update',
    role: 'staff',
    data: { id: 1, name: 'x' },
    context: { user: { id: 1 }, resource: { owner: 2 } },
  });
  expect(executedHooks).toEqual(['global', 'staff']);
  expect(staff.errors).toEqual([{ code: 'HOOK_ERROR', message: 'not owner', cause: expect.any(Error) }]);
}

async function passResolvedPermission() {
  const portals = setupPortals();
  const capturedPermissions: ResolvedPermission[] = [];
  portals.hook('update', capturePermission.bind(null, capturedPermissions));
  portals.hook('create', throwHookFailure.bind(null, new Error('never')));
  pkit.seal();
  await pkit.validate({ action, method: 'update', role: 'staff', data: { id: 1 } });
  expect(capturedPermissions[0]).toEqual({ role: 'staff', action, method: 'update', enabled: true, properties: ['id', 'name', 'description'] });
  expect(errorCodes(await pkit.validate({ action, method: 'create', role: 'staff', data: { name: 'Portal' } }))).toEqual(['METHOD_DISABLED']);
}

async function useGeneralRole() {
  const executedHooks: string[] = [];
  const portals = pkit.module('portals');
  portals.registerActions({ find: { properties: ['id'], enabled: true } });
  portals.hook('find', recordPermissionRole.bind(null, executedHooks));
  portals.role('general').hook('find', recordHook.bind(null, executedHooks, 'general'));
  pkit.seal();
  expect(await pkit.validate({ action: 'portals', method: 'find' })).toEqual({ result: ['id'], errors: [] });
  expect(executedHooks).toEqual(['global:general', 'general']);
  expect(pkit.permissions.forRole()).toEqual(pkit.permissions.forRole('general'));
}

async function rejectUnknownRole() {
  pkit.module('portals').registerActions({ find: { properties: '*', enabled: true } });
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action: 'portals', method: 'find', role: 'unknown' as never }))).toEqual(['UNKNOWN_ROLE']);
}

async function preserveExplicitDenial() {
  pkit.context.set('roles', ['staff']);
  const portals = pkit.module('portals');
  portals.registerActions({ find: { properties: '*', enabled: true } });
  portals.role('staff').registerActions({ find: { properties: '*', enabled: false } });
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action: 'portals', method: 'find', role: 'staff' }))).toEqual(['METHOD_DISABLED']);
  expect(pkit.permissions.forRole('staff')['portals.find']).toBe(false);
}

async function collectOrderedHookFailures() {
  const portals = setupPortals();
  const firstFailure = new Error('first failure');
  const laterFailure = { reason: 'later failure' };
  const completionOrder: string[] = [];
  portals.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'first', cause: firstFailure, delay: 10 }));
  portals.hook('find', failRecordedHook.bind(null, completionOrder, { label: 'second', cause: 'second failure', delay: 0 }));
  portals.role('staff').hook('find', failRecordedHook.bind(null, completionOrder, { label: 'staff', cause: laterFailure, delay: 0 }));
  pkit.seal();
  const validation = await pkit.validate({ action, method: 'find', role: 'staff' });
  expect(completionOrder).toEqual(['second', 'staff', 'first']);
  expect(validation).toEqual({ result: null, errors: [
      { code: 'HOOK_ERROR', message: 'first failure', cause: firstFailure },
      { code: 'HOOK_ERROR', message: 'second failure', cause: 'second failure' },
      { code: 'HOOK_ERROR', message: '[object Object]', cause: laterFailure },
    ] });
  expect(Object.isFrozen(validation.errors)).toBe(true);
}

async function rejectInvalidData({ data }: { data: unknown }) {
  setupPortals();
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action, method: 'update', role: 'admin', data } as never))).toEqual(['INVALID_INPUT']);
}

async function rejectInvalidContext({ context }: { context: unknown }) {
  setupPortals();
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'admin', context } as never))).toEqual(['INVALID_INPUT']);
}

async function rejectInvalidSelection({ select }: { select: unknown }) {
  setupPortals();
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action, method: 'find', role: 'admin', select } as never))).toEqual(['INVALID_INPUT']);
}

async function preserveUnexpectedCause() {
  setupPortals();
  pkit.seal();
  const failure = new Error('broken request data');
  const input = Object.defineProperty({ action, method: 'find' as const }, 'data', { get: throwHookFailure.bind(null, failure) });
  expect(await pkit.validate(input)).toEqual({ result: null, errors: [
      { code: 'VALIDATION_ERROR', message: 'no se pudo validar el permiso', cause: failure },
    ] });
}

async function stopHooksOnFieldDenial() {
  const portals = setupPortals();
  const executedHooks: string[] = [];
  portals.hook('update', recordHook.bind(null, executedHooks, 'update'));
  pkit.seal();
  expect(errorCodes(await pkit.validate({ action, method: 'update', role: 'staff', data: { owner: 1 } }))).toEqual(['PROPERTIES_NOT_ALLOWED']);
  expect(executedHooks).toEqual([]);
}

test('escritura sin data falla sin fabricar un objeto vacío', rejectMissingWriteData);
test('los hooks reciben los datos opcionales ausentes sin sustituirlos', preserveMissingHookArguments);
test('un hook síncrono fallido no impide ejecutar los siguientes', continueAfterSynchronousFailure);

async function rejectMissingWriteData(): Promise<void> {
  setupPortals();
  pkit.seal();
  expect(await pkit.validate({ action, method: 'update', role: 'admin' } as never)).toEqual({
    result: null, errors: [{ code: 'INVALID_INPUT', message: 'data debe ser un objeto' }],
  });
}

async function preserveMissingHookArguments(): Promise<void> {
  const portals = setupPortals();
  portals.hook('find', expectMissingArguments);
  pkit.seal();
  expect((await pkit.validate({ action, method: 'find', role: 'staff' })).errors).toEqual([]);
}

function expectMissingArguments(data: Data | undefined, context: Context | undefined): void {
  expect(data).toBeUndefined();
  expect(context).toBeUndefined();
}

async function continueAfterSynchronousFailure(): Promise<void> {
  const portals = setupPortals();
  const executedHooks: string[] = [];
  portals.hook('find', throwHookFailure.bind(null, 'synchronous failure'));
  portals.hook('find', recordHook.bind(null, executedHooks, 'next'));
  pkit.seal();
  expect(await pkit.validate({ action, method: 'find' })).toEqual({
    result: null, errors: [{ code: 'HOOK_ERROR', message: 'synchronous failure', cause: 'synchronous failure' }],
  });
  expect(executedHooks).toEqual(['next']);
}

test('la petición usa la misma data para campos, hooks y resultado', readWriteDataOnce);

async function readWriteDataOnce(): Promise<void> {
  setupPortals();
  pkit.seal();
  const data = { id: 1 };
  const reads: number[] = [];
  const input = { action, method: 'update' as const, role: 'staff' as const, data };
  Object.defineProperty(input, 'data', { get: readRecordedData.bind(null, reads, data) });
  expect(await pkit.validate(input)).toEqual({ result: data, errors: [] });
  expect(reads).toEqual([1]);
}

function readRecordedData(reads: number[], data: Data): Data {
  reads.push(1);
  return data;
}
