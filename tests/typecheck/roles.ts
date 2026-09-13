import pkit from 'endpoint-permissions-kit';
import type { Context, Data, PermissionId, ResolvedPermission, Role } from 'endpoint-permissions-kit/types';

void verifyRoleContracts();

async function verifyRoleContracts(): Promise<void> {
  const declaredRole: Role = 'staff';
  // @ts-expect-error
  const misspelledRole: Role = 'staf';
  const reportsId: PermissionId = 'staff::inventory.reports::all';
  // @ts-expect-error
  const foreignId: PermissionId = 'nobody::inventory.reports::all';
  void [declaredRole, misspelledRole, reportsId, foreignId];

  const items = pkit.module('inventory').module('items').name('all');
  items.role('admin').registerActions({ find: { properties: '*', enabled: true } });
  // @ts-expect-error
  items.role('adminn');
  // @ts-expect-error
  items.registerActions({ find: { properties: '*', enabled: true } });
  items.grantTo(reportsId).registerActions({ find: { enabled: true, properties: ['id'] } });
  // @ts-expect-error
  items.grantTo(reportsId).registerActions({ find: { enabled: false, properties: ['id'] } });
  // @ts-expect-error
  items.grantTo(reportsId).registerActions({ find: { enabled: true, properties: '*' } });
  // @ts-expect-error
  items.grantTo(reportsId).role('staff');
  items.role('staff').hook('update', inspectHookArguments);

  const identity = { role: 'staff', permissions: ['staff::inventory.reports::all'] } as const;
  void pkit.validate({ ...identity, action: 'inventory.items', name: 'all', method: 'find', select: ['id'] });
  // @ts-expect-error
  void pkit.validate({ ...identity, action: 'inventory.items', name: 'all', method: 'update', data: { id: 1 }, select: ['id'] });
  // @ts-expect-error
  void pkit.validate({ ...identity, action: 'inventory.items', name: 'all', method: 'list' });
  // @ts-expect-error
  void pkit.validate({ ...identity, action: 'inventory.items', name: 'all', method: 'update' });
  // @ts-expect-error
  void pkit.validate({ action: 'inventory.items', name: 'all', method: 'find', role: 'staff' });
  // @ts-expect-error
  void pkit.validate({ action: 'inventory.items', name: 'all', method: 'find', permissions: [] });
  // @ts-expect-error
  void pkit.validate({ ...identity, action: 'inventory.items', method: 'find' });

  const validation = await pkit.validate({ ...identity, action: 'inventory.items', name: 'all', method: 'update', data: { id: 1 } });
  const id: number | undefined = validation.result?.id;
  void id;
  // @ts-expect-error
  if (validation.errors[0]?.code === 'HOOK_ERROR') void validation.errors[0].fields;

  const access = pkit.permissions.forUser(identity);
  const canFind: boolean | undefined = access['staff::inventory.items::all']?.find;
  void canFind;
  // @ts-expect-error
  pkit.permissions.forUser({ role: 'nobody', permissions: [] });

  const catalog = pkit.permissions.named;
  void catalog['staff::inventory.items::all']?.find?.enabled;
  // @ts-expect-error
  void catalog['nobody::inventory.items::all'];
}

function inspectHookArguments(data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  const role: Role = permission.role;
  const grantedBy: readonly PermissionId[] = permission.authorization.grantedBy;
  void [data, context, role, grantedBy, permission.permissionId, permission.name];
}
