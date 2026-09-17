import { describe, expect, test } from 'bun:test';
import Pkit from '../src/index';
import { STAFF_ITEMS_ALL, setupInventory } from './helpers';

const findId = { find: { enabled: true, properties: ['id'] } } as const;

describe('instances', () => {
  test('two instances share no roles, modules or permissions', async () => {
    const { pkit: first } = setupInventory();
    const second = new Pkit({ roles: ['guest'] });

    second.module('docs').name('all').role('guest').registerActions(findId);

    expect(second.context.get('roles')).toEqual(['guest']);
    expect(Object.keys(second.permissions.named)).toEqual(['guest::docs::all']);
    expect(first.permissions.named['guest::docs::all' as never]).toBeUndefined();

    const unknownRole = await second.validate({ action: 'inventory.items', method: 'find', role: 'staff' as never, permissions: [STAFF_ITEMS_ALL] });

    expect(unknownRole.result).toBeNull();
    expect(unknownRole.errors[0]?.code).toBe('UNKNOWN_ROLE');

    const unknownAction = await first.validate({ action: 'docs', method: 'find', role: 'staff', permissions: [STAFF_ITEMS_ALL] });

    expect(unknownAction.result).toBeNull();
    expect(unknownAction.errors[0]?.code).toBe('UNKNOWN_ACTION');
  });

  test('registering after a successful validate invalidates the snapshot', async () => {
    const { pkit } = setupInventory();
    const input = { action: 'inventory.items', method: 'find', role: 'staff', permissions: [STAFF_ITEMS_ALL], data: { id: 1 } } as const;

    expect((await pkit.validate(input)).errors).toEqual([]);

    const before = await pkit.validate({ ...input, action: 'inventory.audit', permissions: ['staff::inventory.audit::all'] });

    expect(before.errors[0]?.code).toBe('UNKNOWN_PERMISSION');

    pkit.module('inventory').module('audit').name('all').role('staff').registerActions(findId);

    const after = await pkit.validate({ ...input, action: 'inventory.audit', permissions: ['staff::inventory.audit::all'] });

    expect(after.errors).toEqual([]);
    expect(after.result?.data).toEqual({ id: 1 });
    expect(pkit.permissions.named['staff::inventory.audit::all']).toBeDefined();
  });

  test('context.set cropper after a validate changes the next validation', async () => {
    const { pkit } = setupInventory();
    const input = { action: 'inventory.items', method: 'find', role: 'staff', permissions: [STAFF_ITEMS_ALL], data: { id: 1, secret: 'x' } } as const;

    const denied = await pkit.validate(input);

    expect(denied.result).toBeNull();
    expect(denied.errors[0]?.code).toBe('PROPERTIES_NOT_ALLOWED');

    pkit.context.set('cropper', true);

    const cropped = await pkit.validate(input);

    expect(cropped.errors).toEqual([]);
    expect(cropped.result?.data).toEqual({ id: 1 });
    expect(pkit.context.get('cropper')).toBe(true);
  });

  test('context.set roles after registering keeps existing registrations and reports the new catalog', async () => {
    const { pkit } = setupInventory();

    pkit.context.set('roles', ['admin', 'staff', 'public', 'auditor'] as never);

    expect(pkit.context.get('roles')).toEqual(['admin', 'staff', 'public', 'auditor']);
    expect(pkit.permissions.named[STAFF_ITEMS_ALL]).toBeDefined();

    pkit.module('inventory').module('items').name('all').role('auditor' as never).registerActions(findId);

    expect(pkit.permissions.named['auditor::inventory.items::all' as never]).toBeDefined();

    const validation = await pkit.validate({ action: 'inventory.items', method: 'find', role: 'staff', permissions: [STAFF_ITEMS_ALL], data: { id: 1 } });

    expect(validation.errors).toEqual([]);
  });
});
