import pkit from 'endpoint-permissions-kit';
import type { Context, Data, ResolvedPermission, Role } from 'endpoint-permissions-kit/types';

void verifyRoleContracts();

async function verifyRoleContracts(): Promise<void> {
  const declaredRole: Role = 'staff';
  // @ts-expect-error
  const misspelledRole: Role = 'staf';
  void [declaredRole, misspelledRole];

  const portals = pkit.module('marketing').module('portals');
  portals.role('admin').registerActions({ find: { properties: '*', enabled: true } });
  // @ts-expect-error
  portals.role('adminn');
  portals.role('staff').hook('update', inspectHookArguments);

  void pkit.validate({ action: 'marketing.portals', method: 'find', role: 'public', select: ['id'] });
  // @ts-expect-error
  void pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', data: { id: 1 }, select: ['id'] });
  // @ts-expect-error
  void pkit.validate({ action: 'marketing.portals', method: 'list', role: 'staff' });
  // @ts-expect-error
  void pkit.validate({ action: 'marketing.portals', method: 'update' });

  const validation = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', data: { id: 1 } });
  const id: number | undefined = validation.result?.id;
  void id;
  // @ts-expect-error
  if (validation.errors[0]?.code === 'HOOK_ERROR') void validation.errors[0].fields;

  pkit.permissions.forRole('staff');
  // @ts-expect-error
  pkit.permissions.forRole('nobody');

  const catalog = pkit.permissions.all;
  void catalog.staff['marketing.portals.find']?.enabled;
  // @ts-expect-error
  void catalog.nobody;

  void pkit.validate({ action: 'marketing.portals', method: 'find' });
  void pkit.validate({ action: 'marketing.portals', method: 'update', data: { id: 1 } });
  pkit.permissions.forRole();
}

function inspectHookArguments(data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  const role: Role = permission.role;
  void [data, context, role];
}
