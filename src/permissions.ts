import type { MethodAccessMap, NamedPermissionCatalog, UserAssignments, UserPermissionMap } from './types';
import { METHODS } from './constants';
import { permissionIdOf, resolveAccess } from './resolve';
import { getOrCreateState, type NameEntry } from './state';
import { validateIdentity, validateSnapshot } from './Validators';

function getNamedCatalog(): NamedPermissionCatalog {
  const { snapshot } = getOrCreateState();
  validateSnapshot(snapshot);

  return snapshot.named;
}

function resolveMethodAccess(nameEntry: NameEntry, permissionId: string, role: string, assigned: ReadonlySet<string>): MethodAccessMap | undefined {
  const methodAccess: Record<string, boolean> = Object.create(null);
  let reachable = false;

  for (const method of METHODS) {
    const access = resolveAccess(nameEntry, permissionId, role, method, assigned);
    methodAccess[method] = access.status === 'granted';
    if (access.status !== 'unassigned') reachable = true;
  }

  return reachable ? Object.freeze(methodAccess) as MethodAccessMap : undefined;
}

function forUser(assignments: UserAssignments): UserPermissionMap {
  const state = getOrCreateState();
  const { role, assigned } = validateIdentity(assignments, state);

  const access: Record<string, MethodAccessMap> = Object.create(null);
  for (const [action, registeredModule] of state.modules) {
    for (const [name, nameEntry] of registeredModule.names) {
      const permissionId = permissionIdOf(role, action, name);
      const methodAccess = resolveMethodAccess(nameEntry, permissionId, role, assigned);
      if (methodAccess) access[permissionId] = methodAccess;
    }
  }

  return Object.freeze(access) as UserPermissionMap;
}

export const permissions = Object.defineProperty({ forUser }, 'named', { get: getNamedCatalog, enumerable: true, configurable: true }) as {
  readonly named: NamedPermissionCatalog;
  forUser: typeof forUser;
};
