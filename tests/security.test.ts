import { beforeEach, describe, expect, test } from 'bun:test';
import pkit from '../src/index';
import constants from '../src/constants';
import type { Context, Data, Method, ValidationError } from '../src/types';
import { resetState } from './helpers';

const STAFF_VAULT = 'staff::vault::all';
const ADMIN_VAULT = 'admin::vault::all';
const STAFF_AUDIT = 'staff::audit::all';

const STUDENTS = 'management.students';

const STUDENTS_ALL = 'staff::management.students::all';

const STUDENTS_READ_ONLY = 'staff::management.students::read-only';

const STUDENTS_ONLY_RELATED = 'staff::management.students::only-related';

const GRADES = 'management.students.grades';

const GRADES_ALL = 'staff::management.students.grades::all';

const STUDENT = 'management.student';

const staffVault = { action: 'vault', role: 'staff', permissions: [STAFF_VAULT] } as const;
const adminVault = { action: 'vault', role: 'admin', permissions: [ADMIN_VAULT] } as const;
const staffAudit = { action: 'vault', role: 'staff', permissions: [STAFF_AUDIT] } as const;

const ALL_METHODS: Method[] = [...constants.METHODS];

const WRITE_METHODS: Method[] = ['update', 'create', 'remove'];

const HOOKED_METHODS: Method[] = ['find', 'update', 'create'];

describe('security', () => {
  beforeEach(resetState);

  describe('identity', () => {
    test.each(ALL_METHODS)('denies %s when the identifier belongs to another role', async (method: Method) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method, permissions: [ADMIN_VAULT], data: {} }))).toEqual(['PERMISSION_ROLE_MISMATCH']);
    });

    test.each(ALL_METHODS)('denies %s for an unknown role', async (method: Method) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method, role: 'root' as never, data: {} }))).toEqual(['UNKNOWN_ROLE']);
    });

    test.each(ALL_METHODS)('denies %s without assignments', async (method: Method) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method, permissions: [], data: {} }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test.each(ALL_METHODS)('denies %s for an identifier that is not assignable', async (method: Method) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method, permissions: ['staff::vault::retired'], data: {} }))).toEqual(['UNKNOWN_PERMISSION']);
    });

    test.each([
      'staff::vault', 'staff::vault::all::extra', '::vault::all', 'staff::::all', 'staff::vault::*', ' staff::vault::all', 'staff::vault::all ',
    ])('denies a malformed identifier %p', async (permissionId: string) => {
      setupVault();

      const validation = await pkit.validate({ ...staffVault, method: 'find', permissions: [permissionId], data: {} });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)[0]).toMatch(/INVALID_INPUT|UNKNOWN_PERMISSION|PERMISSION_ROLE_MISMATCH/);
    });

    test('denies the whole request when one stored identifier is stale', async () => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'find', permissions: [STAFF_VAULT, 'staff::vault::removed'], data: {} }))).toEqual(['UNKNOWN_PERMISSION']);
    });

    test('never lets an assignment of one module reach another module', async () => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, action: 'audit', method: 'find', data: {} }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });
  });

  describe('method isolation', () => {
    test('keeps a disabled method denied even with allowed data', async () => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
    });

    test.each(WRITE_METHODS)('does not let a find grant enable %s', async (method: Method) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffAudit, method, permissions: [STAFF_AUDIT], data: {} }))).toEqual(['METHOD_DISABLED']);
    });

    test('denies the method before the properties and before the hooks', async () => {
      const executedHooks: string[] = [];

      setupVault(false, executedHooks);

      const validation = await pkit.validate({ ...staffVault, method: 'remove', data: { id: 1, secret: 's' } });

      expect(codesOf(validation)).toEqual(['METHOD_DISABLED']);
      expect(executedHooks).toEqual([]);
    });

    test('keeps the methods of one role out of another role', async () => {
      setupVault();

      expect((await pkit.validate({ ...adminVault, method: 'remove', data: { id: 1 } })).errors).toEqual([]);
      expect(codesOf(await pkit.validate({ ...staffVault, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
    });
  });

  describe('property denial', () => {
    test.each([
      { method: 'find' as Method, data: { id: 1, secret: 's' }, fields: ['secret'] },
      { method: 'update' as Method, data: { name: 'x', role: 'admin' }, fields: ['role'] },
      { method: 'create' as Method, data: { name: 'x', owner: 2 }, fields: ['owner'] },
    ])('denies $method with the exact forbidden fields', async ({ method, data, fields }: { method: Method; data: Data; fields: readonly string[] }) => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method, data }))).toEqual(fields);
    });

    test('denies a remove that carries more than the allowed key', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...adminVault, method: 'remove', data: { id: 1, cascade: true } }))).toEqual(['cascade']);
    });

    test('is case sensitive', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { Name: 'x' } }))).toEqual(['Name']);
      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { NAME: 'x' } }))).toEqual(['NAME']);
    });

    test('does not let a literal dotted key impersonate a nested path', async () => {
      setupVault();

      expect((await pkit.validate({ ...staffVault, method: 'update', data: { profile: { email: 'a@b.c' } } })).errors).toEqual([]);
      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { 'profile.email': 'a@b.c' } }))).toEqual(['profile.email']);
    });

    test('does not let a bracket in a key impersonate an array path', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { 'name[0]': 'x' } }))).toEqual(['name[0]']);
    });

    test('does not let a wildcard key match itself as a pattern', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { '*': 'x' } }))).toEqual(['*']);
      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { profile: { '*': 'x' } } }))).toEqual(['profile.*']);
    });

    test('denies a sibling of an allowed nested path', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { profile: { role: 'admin' } } }))).toEqual(['profile.role']);
    });

    test('denies a prototype payload without polluting anything', async () => {
      setupVault();

      const payload: Data = JSON.parse('{"__proto__":{"polluted":true},"name":"x"}');
      const validation = await pkit.validate({ ...staffVault, method: 'update', data: payload });

      expect(fieldsOf(validation)).toEqual(['__proto__.polluted']);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    test('denies constructor and prototype keys like any other key', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { constructor: 'x' } }))).toEqual(['constructor']);
      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { prototype: 'x' } }))).toEqual(['prototype']);
    });

    test('reports a forbidden key inside an array once', async () => {
      setupVault();

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: { items: [{ secret: 'a' }, { secret: 'b' }] } }))).toEqual(['items.secret']);
    });

    test('compares the keys of a null prototype object', async () => {
      setupVault();

      const payload = Object.assign(Object.create(null), { name: 'x', secret: 's' }) as Data;

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: payload }))).toEqual(['secret']);
    });

    test('denies a key whose only leaves are cycles', async () => {
      setupVault();

      const payload: Data = { name: 'x' };
      const cycle: Data = {};

      cycle.loop = cycle;
      payload.escalation = cycle;

      expect(fieldsOf(await pkit.validate({ ...staffVault, method: 'update', data: payload }))).toEqual(['escalation.loop']);
    });

    test('denies a key that points back at the request data', async () => {
      setupVault();

      const payload: Data = { name: 'x' };

      payload.self = payload;

      const validation = await pkit.validate({ ...staffVault, method: 'update', data: payload });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['PROPERTIES_NOT_ALLOWED']);
    });
  });

  describe('cropper', () => {
    test.each([
      { method: 'find' as Method, data: { id: 1, secret: 's' }, cropped: { id: 1 } },
      { method: 'update' as Method, data: { name: 'x', role: 'admin' }, cropped: { name: 'x' } },
      { method: 'create' as Method, data: { name: 'x', owner: 2 }, cropped: { name: 'x' } },
    ])('crops $method to the permission', async ({ method, data, cropped }: { method: Method; data: Data; cropped: Data }) => {
      setupVault(true);

      const validation = await pkit.validate({ ...staffVault, method, data });

      expect(validation.result?.data).toEqual(cropped);
      expect(validation.errors).toEqual([]);
    });

    test('never returns a key outside the permission for a hostile payload', async () => {
      setupVault(true);

      const payload: Data = JSON.parse('{"__proto__":{"polluted":true},"name":"x","role":"admin","profile":{"email":"a@b.c","role":"admin"}}');
      const validation = await pkit.validate({ ...staffVault, method: 'update', data: payload });

      expect(validation.result?.data).toEqual({ name: 'x', profile: { email: 'a@b.c' } });
      expect((validation.result?.data as Record<string, unknown>).polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    test('does not mutate the request data, including nested containers', async () => {
      setupVault(true);

      const profile = { email: 'a@b.c', role: 'admin' };
      const data: Data = { name: 'x', role: 'admin', profile, items: [{ secret: 's' }] };

      await pkit.validate({ ...staffVault, method: 'update', data });

      expect(data).toEqual({ name: 'x', role: 'admin', profile: { email: 'a@b.c', role: 'admin' }, items: [{ secret: 's' }] });
      expect(profile.role).toBe('admin');
    });

    test('hands the hooks the cropped data on every method', async () => {
      const capturedData: Data[] = [];

      setupVault(true, undefined, capturedData);

      await pkit.validate({ ...staffVault, method: 'find', data: { id: 1, secret: 's' } });
      await pkit.validate({ ...staffVault, method: 'update', data: { name: 'x', role: 'admin' } });
      await pkit.validate({ ...staffVault, method: 'create', data: { name: 'x', owner: 2 } });

      expect(capturedData).toEqual([{ id: 1 }, { name: 'x' }, { name: 'x' }]);
    });

    test('does not turn a disabled method into an allowed one', async () => {
      setupVault(true);

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'remove', data: { id: 1 } }))).toEqual(['METHOD_DISABLED']);
    });

    test('cannot be switched on after seal', () => {
      setupVault();

      expect(pkit.context.set.bind(null, 'cropper', true)).toThrow(/pkit.seal\(\) was already called/);
    });
  });

  describe('hostile input shapes', () => {
    test.each([{ data: null }, { data: 'x' }, { data: 7 }, { data: [] }, { data: true }])('refuses data %j instead of coercing it', async ({ data }: { data: unknown }) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'update', data } as never))).toEqual(['INVALID_INPUT']);
    });

    test.each([{ context: null }, { context: 'x' }, { context: [] }])('refuses context %j instead of coercing it', async ({ context }: { context: unknown }) => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'find', context } as never))).toEqual(['INVALID_INPUT']);
    });

    test('never succeeds when reading the data throws', async () => {
      setupVault();

      const data: Data = { name: 'x' };

      Object.defineProperty(data, 'boom', { enumerable: true, get: throwOnRead });

      const validation = await pkit.validate({ ...staffVault, method: 'update', data });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['VALIDATION_ERROR']);
    });

    test('never succeeds on a payload too deep to walk', async () => {
      setupVault(true);

      const validation = await pkit.validate({ ...staffVault, method: 'update', data: { name: 'x', deep: deepPayload(20000) } });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['VALIDATION_ERROR']);
    });

    test('rejects a method that is not one of the four', async () => {
      setupVault();

      for (const method of ['delete', 'list', '__proto__', 'constructor', 'FIND', '']) {
        expect(codesOf(await pkit.validate({ ...staffVault, method, data: {} } as never))).toEqual(['INVALID_INPUT']);
      }
    });

    test('rejects an unregistered module without leaking which one exists', async () => {
      setupVault();

      expect(codesOf(await pkit.validate({ ...staffVault, action: 'ghost', method: 'find', data: {} }))).toEqual(['UNKNOWN_ACTION']);
    });
  });

  describe('hooks', () => {
    test.each(HOOKED_METHODS)('denies %s when a hook fails', async (method: Method) => {
      resetState();
      pkit.context.set('roles', ['staff']);

      const vault = pkit.module('vault').name('all');

      vault.role('staff').registerActions({
        find: { enabled: true, properties: ['id'] },
        update: { enabled: true, properties: ['id'] },
        create: { enabled: true, properties: ['id'] },
      });
      vault.hook(method, throwOnRead);
      pkit.seal();

      const validation = await pkit.validate({ ...staffVault, method, data: { id: 1 } });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['HOOK_ERROR']);
    });

    test('ignores what a hook returns, including false', async () => {
      resetState();
      pkit.context.set('roles', ['staff']);
      pkit.module('vault').name('all').role('staff')
        .registerActions({ find: { enabled: true, properties: ['id'] } })
        .hook('find', returnFalse);
      pkit.seal();

      expect((await pkit.validate({ ...staffVault, method: 'find', data: { id: 1 } })).errors).toEqual([]);
    });

    test('never runs a hook when the properties are denied', async () => {
      const executedHooks: string[] = [];

      setupVault(false, executedHooks);

      await pkit.validate({ ...staffVault, method: 'update', data: { role: 'admin' } });

      expect(executedHooks).toEqual([]);
    });

    test('hands the hook the identifiers of the caller, not the resolved permission', async () => {
      const capturedPermissions: (readonly string[])[] = [];

      setupVault(false, undefined, undefined, capturedPermissions);

      await pkit.validate({ ...staffAudit, method: 'find', data: { id: 1 } });

      expect(capturedPermissions[0]).toEqual([STAFF_AUDIT]);
    });
  });

  describe('registration hardening', () => {
    test.each([
      { properties: ['*'] }, { properties: ['*.name'] }, { properties: ['*.*'] }, { properties: ['name[0]'] },
      { properties: ['name..first'] }, { properties: ['name.'] }, { properties: ['.name'] }, { properties: ['id', 'id'] }, { properties: [''] },
    ])('refuses to register properties $properties', ({ properties }: { properties: readonly string[] }) => {
      resetState();
      pkit.context.set('roles', ['staff']);

      const builder = pkit.module('vault').name('all').role('staff');

      expect(builder.registerActions.bind(null, { update: { enabled: true, properties } })).toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION' }));
    });

    test('refuses a grant that is wider than a grant may be', () => {
      resetState();
      pkit.context.set('roles', ['staff']);

      const vault = pkit.module('vault').name('all');

      expect(vault.grantTo(STAFF_AUDIT).registerActions.bind(null, { find: { enabled: true, properties: '*' } as never })).toThrow(/explicit properties list/);
      expect(vault.grantTo('staff::other::all').registerActions.bind(null, { find: { enabled: false, properties: ['id'] } as never })).toThrow(/enabled: false/);
      expect(vault.grantTo(STAFF_VAULT).registerActions.bind(null, { find: { enabled: true, properties: ['id'] } })).toThrow(/cannot grant to itself/);
    });

    test('refuses reserved role and name segments', () => {
      resetState();
      pkit.context.set('roles', ['staff']);

      expect(pkit.module('vault').name.bind(null, '*')).toThrow(/reserved/);
      expect(pkit.module('vault').name('all').role.bind(null, '*' as never)).toThrow(/reserved for global hooks/);
      expect(pkit.context.set.bind(null, 'roles', ['*'])).toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION' }));
    });

    test('refuses every registration after seal', () => {
      setupVault();

      const vault = pkit.module('vault').name('all');

      expect(vault.role('staff').registerActions.bind(null, { find: { enabled: true, properties: ['id'] } })).toThrow(/already called/);
      expect(vault.hook.bind(null, 'find', returnFalse)).toThrow(/already called/);
      expect(pkit.context.set.bind(null, 'roles', ['staff'])).toThrow(/already called/);
    });

    test('refuses to validate before seal', async () => {
      resetState();
      pkit.context.set('roles', ['staff']);
      pkit.module('vault').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

      expect(codesOf(await pkit.validate({ ...staffVault, method: 'find', data: {} }))).toEqual(['NOT_SEALED']);
    });
  });

  describe('name resolution', () => {
    test('denies the request when two assigned names share the module', async () => {
      setupStudents();

      const validation = await pkit.validate({
        action: STUDENTS, method: 'find', role: 'staff', permissions: [STUDENTS_ALL, STUDENTS_ONLY_RELATED],
      });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['AMBIGUOUS_PERMISSION']);
    });

    test('denies a request for another module when the assignments are ambiguous', async () => {
      setupStudents();

      const validation = await pkit.validate({
        action: GRADES, method: 'find', role: 'staff', permissions: [GRADES_ALL, STUDENTS_ALL, STUDENTS_ONLY_RELATED],
      });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['AMBIGUOUS_PERMISSION']);
    });

    test('never lets a submodule identifier resolve its parent module', async () => {
      setupStudents();

      const validation = await pkit.validate({ action: STUDENTS, method: 'find', role: 'staff', permissions: [GRADES_ALL] });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('never lets a parent module identifier resolve its submodule', async () => {
      setupStudents();

      const validation = await pkit.validate({ action: GRADES, method: 'find', role: 'staff', permissions: [STUDENTS_ALL] });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('never lets a module resolve another whose name is its textual prefix', async () => {
      setupStudents();

      const validation = await pkit.validate({ action: STUDENT, method: 'find', role: 'staff', permissions: [STUDENTS_ALL] });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('resolves the variant the user holds, with its own methods', async () => {
      setupStudents();

      const all = { action: STUDENTS, role: 'staff', permissions: [STUDENTS_ALL] } as const;
      const readOnly = { action: STUDENTS, role: 'staff', permissions: [STUDENTS_READ_ONLY] } as const;
      const onlyRelated = { action: STUDENTS, role: 'staff', permissions: [STUDENTS_ONLY_RELATED] } as const;

      expect((await pkit.validate({ ...all, method: 'update', data: { name: 'x' } })).errors).toEqual([]);
      expect((await pkit.validate({ ...readOnly, method: 'find', data: { grade: 'A' } })).errors).toEqual([]);
      expect(codesOf(await pkit.validate({ ...readOnly, method: 'update', data: { name: 'x' } }))).toEqual(['METHOD_DISABLED']);
      expect((await pkit.validate({ ...onlyRelated, method: 'find', data: { name: 'x' } })).errors).toEqual([]);
      expect(codesOf(await pkit.validate({ ...onlyRelated, method: 'find', data: { grade: 'A' } }))).toEqual(['PROPERTIES_NOT_ALLOWED']);
    });

    test('denies the module when no name is assigned and no grant reaches one', async () => {
      setupStudents();

      const validation = await pkit.validate({ action: STUDENTS, method: 'find', role: 'staff', permissions: [] });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('falls back to the only name a grant reaches', async () => {
      setupSingleGrant();

      const validation = await pkit.validate({ action: 'library', method: 'find', role: 'staff', permissions: [STAFF_AUDIT], data: { id: 1 } });

      expect(validation.errors).toEqual([]);
      expect(validation.result).toEqual({ data: { id: 1 } });
    });

    test('denies the module when grants reach two names of it', async () => {
      setupAmbiguousGrant();

      const validation = await pkit.validate({ action: 'library', method: 'find', role: 'staff', permissions: [STAFF_AUDIT], data: { id: 1 } });

      expect(validation.result).toBeNull();
      expect(codesOf(validation)).toEqual(['AMBIGUOUS_PERMISSION']);
    });

    test('resolves forUser to the same name validate resolves', async () => {
      setupStudents();

      const identity = { role: 'staff', permissions: [STUDENTS_READ_ONLY] } as const;
      const access = pkit.permissions.forUser(identity);

      expect(Object.keys(access)).toEqual([STUDENTS_READ_ONLY]);
      expect(access[STUDENTS_READ_ONLY]).toEqual({ find: true, update: false, create: false, remove: false });
      expect((await pkit.validate({ ...identity, action: STUDENTS, method: 'find' })).errors).toEqual([]);
    });

    test('throws the ambiguity from forUser that validate reports as an error', async () => {
      setupStudents();

      const identity = { role: 'staff', permissions: [STUDENTS_ALL, STUDENTS_ONLY_RELATED] } as const;

      expect(pkit.permissions.forUser.bind(null, identity)).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_PERMISSION' }));
      expect(codesOf(await pkit.validate({ ...identity, action: STUDENTS, method: 'find' }))).toEqual(['AMBIGUOUS_PERMISSION']);
    });

    test('throws the grant ambiguity from forUser as well', () => {
      setupAmbiguousGrant();

      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [STAFF_AUDIT] })).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_PERMISSION' }));
    });
  });

  describe('views', () => {
    test('never exposes an identifier of another role to forUser', () => {
      setupVault();

      const access = pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_VAULT] });

      expect(Object.keys(access).every(isStaffIdentifier)).toBe(true);
      expect(access[ADMIN_VAULT]).toBeUndefined();
    });

    test('applies the same identity rules as validate', () => {
      setupVault();

      expect(pkit.permissions.forUser.bind(null, { role: 'staff', permissions: [ADMIN_VAULT] })).toThrow(expect.objectContaining({ code: 'PERMISSION_ROLE_MISMATCH' }));
      expect(pkit.permissions.forUser.bind(null, { role: 'root' as never, permissions: [] })).toThrow(expect.objectContaining({ code: 'UNKNOWN_ROLE' }));
    });

    test('reports a disabled method as false instead of hiding the target', () => {
      setupVault();

      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_VAULT] })[STAFF_VAULT]).toEqual({ find: true, update: true, create: true, remove: false });
    });

    test('freezes the catalog and the views', () => {
      setupVault();

      expect(Object.isFrozen(pkit.permissions.named)).toBe(true);
      expect(Object.isFrozen(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_VAULT] }))).toBe(true);
      expect(Object.isFrozen(pkit.context)).toBe(true);
      expect(Object.isFrozen(pkit)).toBe(true);
    });
  });
});

function setupStudents(): void {
  resetState();
  pkit.context.set('roles', ['admin', 'staff']);

  const students = pkit.module('management').module('students');

  students.name('all').role('staff').registerActions({
    find: { enabled: true, properties: '*' },
    update: { enabled: true, properties: '*' },
    create: { enabled: true, properties: '*' },
    remove: { enabled: true, properties: ['id'] },
  });

  students.name('read-only').role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name', 'grade'] },
  });

  students.name('only-related').role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name'] },
  });

  pkit.module('management').module('students').module('grades').name('all').role('staff').registerActions({
    find: { enabled: true, properties: '*' },
  });

  pkit.module('management').module('student').name('all').role('staff').registerActions({
    find: { enabled: true, properties: '*' },
  });

  pkit.seal();
}

function setupSingleGrant(): void {
  resetState();
  pkit.context.set('roles', ['admin', 'staff']);

  const library = pkit.module('library');

  library.name('all').role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  library.name('restricted').role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

  pkit.module('audit').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

  library.name('all').grantTo(STAFF_AUDIT).registerActions({ find: { enabled: true, properties: ['id'] } });

  pkit.seal();
}

function setupAmbiguousGrant(): void {
  resetState();
  pkit.context.set('roles', ['admin', 'staff']);

  const library = pkit.module('library');

  library.name('all').role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  library.name('restricted').role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

  pkit.module('audit').name('all').role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

  library.name('all').grantTo(STAFF_AUDIT).registerActions({ find: { enabled: true, properties: ['id'] } });
  library.name('restricted').grantTo(STAFF_AUDIT).registerActions({ find: { enabled: true, properties: ['id'] } });

  pkit.seal();
}

function setupVault(cropper?: boolean, executedHooks?: string[], capturedData?: Data[], capturedPermissions?: (readonly string[])[]): void {
  resetState();
  pkit.context.set('roles', ['admin', 'staff', 'public']);

  if (cropper === true) pkit.context.set('cropper', true);

  const vault = pkit.module('vault').name('all');
  const audit = pkit.module('audit').name('all');

  vault.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name'] },
    update: { enabled: true, properties: ['name', 'profile.email'] },
    create: { enabled: true, properties: ['name'] },
    remove: { enabled: false, properties: [] },
  });

  vault.role('admin').registerActions({
    find: { enabled: true, properties: '*' },
    update: { enabled: true, properties: '*' },
    create: { enabled: true, properties: '*' },
    remove: { enabled: true, properties: ['id'] },
  });

  audit.role('staff').registerActions({ find: { enabled: true, properties: ['id'] } });

  vault.grantTo(STAFF_AUDIT).registerActions({ find: { enabled: true, properties: ['id'] } });

  for (const method of constants.METHODS) {
    if (executedHooks) vault.hook(method, recordHook.bind(null, executedHooks, method));
    if (capturedData) vault.hook(method, captureData.bind(null, capturedData));
    if (capturedPermissions) vault.hook(method, capturePermissions.bind(null, capturedPermissions));
  }

  pkit.seal();
}

function codesOf(validation: { errors: readonly ValidationError[] }): string[] {
  const codes: string[] = [];

  for (const error of validation.errors) codes.push(error.code);

  return codes;
}

function fieldsOf(validation: { errors: readonly ValidationError[] }): readonly string[] | undefined {
  const [error] = validation.errors;

  return error?.code === 'PROPERTIES_NOT_ALLOWED' ? error.fields : undefined;
}

function deepPayload(depth: number): Data {
  const root: Data = {};

  let node = root;

  for (let index = 0; index < depth; index += 1) {
    const next: Data = {};

    node.next = next;
    node = next;
  }

  node.leaf = 1;

  return root;
}

function recordHook(executedHooks: string[], label: string): void {
  executedHooks.push(label);
}

function captureData(captured: Data[], data: Data): void {
  captured.push(data);
}

function capturePermissions(captured: (readonly string[])[], _data: Data, _context: Context, permissions: readonly string[]): void {
  captured.push(permissions);
}

function throwOnRead(): never {
  throw new Error('hostile read');
}

function returnFalse(): boolean {
  return false;
}

function isStaffIdentifier(permissionId: string): boolean {
  return permissionId.startsWith('staff::');
}
