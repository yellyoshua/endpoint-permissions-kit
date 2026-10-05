import { describe, expect, test } from 'bun:test';
import type { Context, Data, ValidationError } from '../src/types';
import Pkit from '../src/index';

const STAFF_LOGOUT = 'staff::account.logout::required';
const ADMIN_LOGOUT = 'admin::account.logout::required';
const STAFF_SESSIONS_REQUIRED = 'staff::account.sessions::required';
const STAFF_SESSIONS_ALL = 'staff::account.sessions::all';
const STAFF_PROFILE = 'staff::account.profile::all';
const STAFF_SUPPORT = 'staff::support::all';
const PUBLIC_CATALOG = 'public::catalog::all';

const FIND_ONLY = { find: true, update: false, create: false, remove: false };
const CREATE_ONLY = { find: false, update: false, create: true, remove: false };
const FIND_AND_REMOVE = { find: true, update: false, create: false, remove: true };

describe('assignToAllUsers', () => {
  describe('registration', () => {
    test('returns the same builder on every call', () => {
      const { account } = setupAccount([]);

      expect(account.module('logout').assignToAllUsers()).toBe(account.module('logout').assignToAllUsers());
    });

    test('name("required") throws INVALID_DEFINITION, also after assignToAllUsers()', () => {
      const { account } = setupAccount([]);
      const fresh = account.module('x');

      expect(fresh.name.bind(null, 'required')).toThrow(/reserved: use assignToAllUsers\(\)/);
      expect(fresh.name.bind(null, 'required')).toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION', name: 'PkitError' }));

      fresh.assignToAllUsers();

      expect(fresh.name.bind(null, 'required')).toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION', name: 'PkitError' }));
    });

    test('the lazy cross-checks cover required', async () => {
      const pkit = new Pkit({ roles: ['staff'] });

      pkit.module('x').assignToAllUsers().hook('find', noop);

      const validation = await pkit.validate({ action: 'x', method: 'find', role: 'staff', permissions: [] });

      expect(validation.result).toBeNull();
      expect(validation.errors[0]).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'registry has invalid definitions',
        cause: expect.objectContaining({ code: 'INVALID_DEFINITION' }),
      });
    });
  });

  describe('validate', () => {
    test('staff reaches logout with no stored rows', async () => {
      const { pkit } = setupAccount([]);

      expect(await pkit.validate({ action: 'account.logout', method: 'create', role: 'staff', permissions: [], data: {} })).toEqual({ result: { data: {} }, errors: [] });
    });

    test('admin reaches logout with no stored rows', async () => {
      const { pkit } = setupAccount([]);
      const validation = await pkit.validate({ action: 'account.logout', method: 'create', role: 'admin', permissions: [] });

      expect(validation.errors).toEqual([]);
    });

    test('a role without required actions gets PERMISSION_NOT_ASSIGNED', async () => {
      const { pkit } = setupAccount([]);

      expect(codesOf(await pkit.validate({ action: 'account.logout', method: 'create', role: 'public', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('required of one role does not reach another role', async () => {
      const { pkit } = setupAccount([]);

      expect(codesOf(await pkit.validate({ action: 'account.sessions', method: 'find', role: 'admin', permissions: [] }))).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('required decides fields and methods', async () => {
      const { pkit } = setupAccount([]);
      const base = { action: 'account.sessions', role: 'staff', permissions: [] } as const;
      const ok = await pkit.validate({ ...base, method: 'find', data: { id: 1, device: 'd' } });
      const denied = await pkit.validate({ ...base, method: 'find', data: { id: 1, userId: 2 } });
      const disabled = await pkit.validate({ ...base, method: 'remove', data: { id: 1 } });

      expect(ok.errors).toEqual([]);
      expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['userId'] });
      expect(codesOf(disabled)).toEqual(['METHOD_DISABLED']);
    });

    test('a stored name of the same module replaces required', async () => {
      const { pkit } = setupAccount([]);
      const base = { action: 'account.sessions', role: 'staff', permissions: [STAFF_SESSIONS_ALL] } as const;
      const found = await pkit.validate({ ...base, method: 'find', data: { id: 1, userId: 2 } });
      const removed = await pkit.validate({ ...base, method: 'remove', data: { id: 1 } });

      expect(found.errors).toEqual([]);
      expect(removed.errors).toEqual([]);
    });

    test('required takes precedence over grants', async () => {
      const { pkit } = setupAccount([]);
      const validation = await pkit.validate({ action: 'account.sessions', method: 'find', role: 'staff', permissions: [STAFF_SUPPORT], data: { id: 1, userId: 2 } });

      expect(validation.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['userId'] });
    });

    test('a stored required row is accepted and ignored', async () => {
      const { pkit } = setupAccount([]);
      const base = { action: 'account.sessions', method: 'find', role: 'staff', data: { userId: 2 } } as const;
      const withAll = await pkit.validate({ ...base, permissions: [STAFF_SESSIONS_REQUIRED, STAFF_SESSIONS_ALL] });
      const alone = await pkit.validate({ ...base, permissions: [STAFF_SESSIONS_REQUIRED] });

      expect(withAll.errors).toEqual([]);
      expect(alone.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['userId'] });
    });

    test('invalid required rows still fail closed', async () => {
      const { pkit } = setupAccount([]);
      const unknown = await pkit.validate({ action: 'account.logout', method: 'create', role: 'public', permissions: ['public::account.logout::required'] });
      const mismatch = await pkit.validate({ action: 'account.logout', method: 'create', role: 'staff', permissions: [ADMIN_LOGOUT] });

      expect(codesOf(unknown)).toEqual(['UNKNOWN_PERMISSION']);
      expect(codesOf(mismatch)).toEqual(['PERMISSION_ROLE_MISMATCH']);
    });

    test('an applied required activates grants; a replaced one does not', async () => {
      const { pkit } = setupAccount([]);
      const base = { action: 'account.profile', method: 'find', role: 'staff' } as const;
      const ok = await pkit.validate({ ...base, permissions: [], data: { id: 1 } });
      const denied = await pkit.validate({ ...base, permissions: [], data: { id: 1, email: 'x' } });
      const replaced = await pkit.validate({ ...base, permissions: [STAFF_SESSIONS_ALL], data: { id: 1 } });

      expect(ok.errors).toEqual([]);
      expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['email'] });
      expect(codesOf(replaced)).toEqual(['PERMISSION_NOT_ASSIGNED']);
    });

    test('migration: users with the old row keep it, the rest use required', async () => {
      const { pkit } = setupAccount([]);
      const base = { action: 'account.sessions', method: 'find', role: 'staff', data: { id: 1, userId: 2 } } as const;
      const withRow = await pkit.validate({ ...base, permissions: [STAFF_SESSIONS_ALL] });
      const withoutRow = await pkit.validate({ ...base, permissions: [] });

      expect(withRow.errors).toEqual([]);
      expect(withoutRow.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['userId'] });
    });
  });

  describe('hook permissions', () => {
    test('hooks receive the injected identifiers when the input is empty', async () => {
      const captured: (readonly string[])[] = [];
      const { pkit } = setupAccount(captured);

      await pkit.validate({ action: 'account.sessions', method: 'find', role: 'staff', permissions: [], data: { id: 1 } });

      expect(captured[0]).toEqual([STAFF_LOGOUT, STAFF_SESSIONS_REQUIRED]);
    });

    test('hooks receive no duplicates', async () => {
      const captured: (readonly string[])[] = [];
      const { pkit } = setupAccount(captured);

      await pkit.validate({ action: 'account.sessions', method: 'find', role: 'staff', permissions: [STAFF_SESSIONS_REQUIRED], data: { id: 1 } });

      expect(captured[0]).toEqual([STAFF_SESSIONS_REQUIRED, STAFF_LOGOUT]);
    });

    test('hooks receive only the applied required identifiers', async () => {
      const captured: (readonly string[])[] = [];
      const { pkit } = setupAccount(captured);

      await pkit.validate({ action: 'account.sessions', method: 'find', role: 'staff', permissions: [STAFF_SESSIONS_ALL], data: { id: 1 } });

      expect(captured[0]).toEqual([STAFF_SESSIONS_ALL, STAFF_LOGOUT]);
    });

    test('hooks receive the input array itself when nothing is injected', async () => {
      const captured: (readonly string[])[] = [];
      const { pkit } = setupAccount(captured);
      const input = [PUBLIC_CATALOG];

      await pkit.validate({ action: 'catalog', method: 'find', role: 'public', permissions: input, data: { id: 1 } });

      expect(captured[0]).toBe(input);
    });
  });

  describe('views', () => {
    test('forUser includes the applied required names', () => {
      const { pkit } = setupAccount([]);

      expect(pkit.permissions.forUser({ role: 'staff', permissions: [] })).toEqual({
        [STAFF_LOGOUT]: CREATE_ONLY,
        [STAFF_SESSIONS_REQUIRED]: FIND_ONLY,
        [STAFF_PROFILE]: FIND_ONLY,
      });
    });

    test('forUser shows the stored name instead of the replaced required', () => {
      const { pkit } = setupAccount([]);

      expect(pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_SESSIONS_ALL] })).toEqual({
        [STAFF_LOGOUT]: CREATE_ONLY,
        [STAFF_SESSIONS_ALL]: FIND_AND_REMOVE,
      });
    });

    test('forRole leaves required names out', () => {
      const { pkit } = setupAccount([]);

      expect(pkit.permissions.forRole('staff')).toEqual({
        modules: [
          {
            name: 'account',
            identifier: 'account',
            actions: [],
            modules: [{ name: 'sessions', identifier: 'sessions', actions: [{ name: 'all', identifier: 'all', resourceName: STAFF_SESSIONS_ALL }] }],
          },
          { name: 'support', identifier: 'support', actions: [{ name: 'all', identifier: 'all', resourceName: STAFF_SUPPORT }] },
        ],
      });
      expect(pkit.permissions.forRole('admin')).toEqual({
        modules: [
          {
            name: 'account',
            identifier: 'account',
            actions: [],
            modules: [{ name: 'profile', identifier: 'profile', actions: [{ name: 'all', identifier: 'all', resourceName: 'admin::account.profile::all' }] }],
          },
        ],
      });
    });

    test('named keeps the required names', () => {
      const { pkit } = setupAccount([]);

      expect(Object.keys(pkit.permissions.named)).toEqual(expect.arrayContaining([STAFF_LOGOUT, ADMIN_LOGOUT, STAFF_SESSIONS_REQUIRED]));
    });
  });
});

function setupAccount(captured: (readonly string[])[]) {
  const pkit = new Pkit({ roles: ['admin', 'staff', 'public'] });
  const account = pkit.module('account');
  const logout = account.module('logout').assignToAllUsers();
  const sessions = account.module('sessions');
  const sessionsRequired = sessions.assignToAllUsers();
  const sessionsAll = sessions.name('all');
  const profile = account.module('profile').name('all');
  const support = pkit.module('support').name('all');
  const catalog = pkit.module('catalog').name('all');
  const capture = capturePermissions.bind(null, captured);

  logout.role('staff').registerActions({ create: { enabled: true, properties: [] } });
  logout.role('admin').registerActions({ create: { enabled: true, properties: [] } });

  sessionsRequired.role('staff').registerActions({ find: { enabled: true, properties: ['id', 'device'] } });
  sessionsAll.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'device', 'userId'] },
    remove: { enabled: true, properties: ['id'] },
  });

  profile.role('admin').registerActions({ find: { enabled: true, properties: '*' } });
  profile.grantTo(STAFF_SESSIONS_REQUIRED).registerActions({ find: { enabled: true, properties: ['id'] } });

  support.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  sessionsAll.grantTo(STAFF_SUPPORT).registerActions({ find: { enabled: true, properties: ['id', 'device', 'userId'] } });

  catalog.role('public').registerActions({ find: { enabled: true, properties: ['id'] } });

  sessionsRequired.role('staff').hook('find', capture);
  sessionsAll.role('staff').hook('find', capture);
  catalog.role('public').hook('find', capture);

  return { pkit, account };
}

function capturePermissions(captured: (readonly string[])[], _data: Data, _context: Context, permissions: readonly string[]): void {
  captured.push(permissions);
}

function noop(): void {}

function codesOf(validation: { errors: readonly ValidationError[] }): string[] {
  const codes: string[] = [];

  for (const error of validation.errors) codes.push(error.code);

  return codes;
}
