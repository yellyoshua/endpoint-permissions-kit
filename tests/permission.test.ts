import { describe, test, expect } from 'bun:test';
import { createPermissions, PermissionManager, parseEndpointPath, isAllowedAction } from '../src/index';

describe('Endpoint Permissions Kit (Source)', () => {
  test('should allow access based on matching rules', () => {
    const kit = createPermissions();

    kit.addRule({
      role: 'admin',
      action: 'read',
      resource: 'users',
    });

    expect(kit.can('admin', 'read', 'users')).toBe(true);
    expect(kit.can('user', 'read', 'users')).toBe(false);
  });

  test('should support wildcard actions and resources', () => {
    const kit = new PermissionManager();
    kit.addRule({
      action: '*',
      resource: 'public/*',
    });

    expect(kit.can('guest', 'read', 'public/*')).toBe(true);
    expect(kit.can('guest', 'write', 'public/*')).toBe(true);
  });

  test('should evaluate custom condition logic', () => {
    const kit = createPermissions();
    kit.addRule({
      action: 'delete',
      resource: 'post',
      condition: (ctx) => ctx?.isOwner === true,
    });

    expect(kit.can('user', 'delete', 'post', { isOwner: true })).toBe(true);
    expect(kit.can('user', 'delete', 'post', { isOwner: false })).toBe(false);
  });

  test('should parse endpoint paths correctly', () => {
    expect(parseEndpointPath('/api/v1/users/123')).toEqual(['api', 'v1', 'users', '123']);
  });

  test('should check allowed actions correctly', () => {
    expect(isAllowedAction('read', ['read', 'write'])).toBe(true);
    expect(isAllowedAction('delete', ['read', 'write'])).toBe(false);
    expect(isAllowedAction('delete', ['*'])).toBe(true);
  });
});
