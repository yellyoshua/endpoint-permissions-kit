import type { PermissionCatalog, PermissionEntry, RolePermissionMap } from './types';
import { METHODS } from './constants';
import { getOrCreateState } from './state';
import { resolveAction } from './resolve';
import { validateRegisteredHooks } from './Validators';

export function seal(): void {
  const state = getOrCreateState();
  if (state.snapshot) return;

  validateRegisteredHooks(state.modules);

  const permissionsByRole: Record<string, Readonly<Record<string, PermissionEntry>>> = Object.create(null);
  const accessByRole = new Map<string, RolePermissionMap>();
  for (const role of state.roles) {
    const rolePermissions: Record<string, PermissionEntry> = Object.create(null);
    const roleAccess: Record<string, boolean> = Object.create(null);
    for (const [action, registeredModule] of state.modules) {
      for (const method of METHODS) {
        const permissionDefinition = resolveAction(registeredModule, role, method);
        const permissionPath = `${action}.${method}`;
        roleAccess[permissionPath] = permissionDefinition?.enabled === true;
        if (permissionDefinition) rolePermissions[permissionPath] = permissionDefinition;
      }
    }
    permissionsByRole[role] = Object.freeze(rolePermissions);
    accessByRole.set(role, Object.freeze(roleAccess));
  }
  state.snapshot = { all: Object.freeze(permissionsByRole) as PermissionCatalog, byRole: accessByRole };
}
