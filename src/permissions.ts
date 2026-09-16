import resolve from './resolve';
import state from './state';
import type { MethodAccessMap, NamedPermissionCatalog, UserAssignments, UserPermissionMap } from './types';

const permissions = Object.freeze({
  /**
   * The effective access of one identity, with the same precedence and identity
   * checks as `validate()` but without running hooks. It resolves one name per
   * module, the same one `validate()` resolves; modules out of reach are omitted.
   */
  forUser(assignments: UserAssignments): UserPermissionMap {
    const currentState = state.getOrCreate();
    const snapshot = state.requireSnapshot(currentState);
    const identity = resolve.identity(assignments, snapshot, currentState.roles);

    const access: Record<string, MethodAccessMap> = Object.create(null);

    for (const [action, registeredModule] of currentState.modules) {
      const chosen = resolve.permission(registeredModule, action, identity);

      if (!chosen) continue;

      const methodAccess = resolve.methodAccess(chosen.entry, chosen.permissionId, identity.role, identity.assigned);

      if (methodAccess) access[chosen.permissionId] = methodAccess;
    }

    return Object.freeze(access) as UserPermissionMap;
  },

  /** The assignable identifiers with their registered actions; grants are not listed. */
  get named(): NamedPermissionCatalog {
    return state.requireSnapshot(state.getOrCreate()).named;
  },
});

export default permissions;
