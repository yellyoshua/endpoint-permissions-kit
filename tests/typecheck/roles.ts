import Pkit from 'endpoint-permissions-kit';
import type { Context, Data, PermissionId, Role } from 'endpoint-permissions-kit/types';

type AppRole = 'admin' | 'staff' | 'public';

const pkit = new Pkit({ roles: ['admin', 'staff', 'public'] });

void verifyRoleContracts();

async function verifyRoleContracts(): Promise<void> {
  const declaredRole: Role<AppRole> = 'staff';
  // @ts-expect-error
  const misspelledRole: Role<AppRole> = 'staf';
  const reportsId: PermissionId<AppRole> = 'staff::inventory.reports::all';
  // @ts-expect-error
  const foreignId: PermissionId<AppRole> = 'nobody::inventory.reports::all';
  void [declaredRole, misspelledRole, reportsId, foreignId];

  const general = new Pkit();
  general.module('inventory').name('all').role('general');
  // @ts-expect-error
  general.module('inventory').name('all').role('staff');

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

  const identity = { role: 'staff', permissions: ['staff::inventory.reports::all'], action: 'inventory.items' } as const;
  void pkit.validate({ ...identity, method: 'find' });
  // @ts-expect-error
  void pkit.validate({ ...identity, method: 'find', name: 'all' });
  void pkit.validate({ ...identity, method: 'create', data: { name: 'x' } });
  void pkit.validate({ ...identity, method: 'remove', data: { id: 1 } });
  void pkit.validate({ ...identity, method: 'update' });
  // @ts-expect-error
  void pkit.validate({ ...identity, method: 'update', select: ['id'] });
  // @ts-expect-error
  void pkit.validate({ ...identity, method: 'find', properties: ['id'] });
  // @ts-expect-error
  void pkit.validate({ ...identity, method: 'list' });
  // @ts-expect-error
  void pkit.validate({ ...identity, method: 'find', data: 'id' });
  // @ts-expect-error
  void pkit.validate({ action: 'inventory.items', method: 'find', role: 'staff' });
  // @ts-expect-error
  void pkit.validate({ action: 'inventory.items', method: 'find', permissions: [] });
  // @ts-expect-error
  void pkit.validate({ ...identity, action: undefined, method: 'find' });
  // @ts-expect-error
  void pkit.validate({ ...identity, role: 'nobody', method: 'find' });

  const validation = await pkit.validate({ ...identity, method: 'update', data: { id: 1 } });
  const id: unknown = validation.result?.data.id;
  void id;
  // @ts-expect-error
  if (validation.errors[0]?.code === 'HOOK_ERROR') void validation.errors[0].fields;

  pkit.context.set('cropper', true);
  // @ts-expect-error
  pkit.context.set('cropper', 'yes');
  // @ts-expect-error
  pkit.context.set('sorter', true);
  pkit.context.set('roles', ['admin', 'public']);
  // @ts-expect-error
  pkit.context.set('roles', ['x']);
  const cropper: boolean = pkit.context.get('cropper');
  void cropper;

  const access = pkit.permissions.forUser({ role: 'staff', permissions: ['staff::inventory.reports::all'] });
  const canFind: boolean | undefined = access['staff::inventory.items::all']?.find;
  void canFind;
  // @ts-expect-error
  pkit.permissions.forUser({ role: 'nobody', permissions: [] });

  const catalog = pkit.permissions.named;
  void catalog['staff::inventory.items::all']?.find?.enabled;
  // @ts-expect-error
  void catalog['nobody::inventory.items::all'];
}

function inspectHookArguments(data: Data, context: Context, permissions: readonly string[]): void {
  const first: string | undefined = permissions[0];
  void [data.id, context.user, first, permissions.length];
}
