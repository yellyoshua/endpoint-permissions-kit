import type { PermissionCatalog, Role, RolePermissionMap } from './types';
import { resolveRole } from './resolve';
import { getOrCreateState } from './state';
import { validateRole, validateSnapshot } from './Validators';

function getCatalog(): PermissionCatalog {
  const { snapshot } = getOrCreateState();
  validateSnapshot(snapshot);
  return snapshot.all;
}

function forRole(role?: Role): RolePermissionMap {
  const state = getOrCreateState();
  const { snapshot } = state;
  validateSnapshot(snapshot);
  const permissionRole = resolveRole(role);
  validateRole(permissionRole, state.roles, 'UNKNOWN_ROLE');
  return snapshot.byRole.get(permissionRole) as RolePermissionMap;
}

export const permissions = Object.defineProperty({ forRole }, 'all', { get: getCatalog, enumerable: true, configurable: true }) as {
  readonly all: PermissionCatalog;
  forRole: typeof forRole;
};
