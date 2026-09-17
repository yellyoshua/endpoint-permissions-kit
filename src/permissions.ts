import type { Snapshot } from './registry';
import type { Identity, ResolvedName } from './resolve';
import type { MethodAccessMap, NamedPermissionCatalog, UserAssignments, UserPermissionMap } from './types';
import constants from './constants';
import errors from './errors';
import identifiers from './identifiers';
import resolve from './resolve';

const permissions = {
  named(snapshot: Snapshot): NamedPermissionCatalog {
    return snapshot.named;
  },

  forUser(snapshot: Snapshot, assignments: UserAssignments): UserPermissionMap {
    if (assignments === null || typeof assignments !== 'object') throw errors.create('INVALID_INPUT', 'assignments must be an object');

    const { role } = assignments;
    const identity = resolve.checkIdentity(snapshot, role, assignments.permissions);
    const access: Record<string, MethodAccessMap> = Object.create(null);

    for (const modulePath of snapshot.modules.keys()) {
      const resolved = resolve.resolveName(snapshot, role, modulePath, identity);

      if (resolved !== null) access[identifiers.build(role, modulePath, resolved.name)] = methodAccess(resolved, role, identity);
    }

    return Object.freeze(access) as UserPermissionMap;
  },
};

export default permissions;

function methodAccess(resolved: ResolvedName, role: string, identity: Identity): MethodAccessMap {
  const enabled = new Set<string>();

  if (resolved.direct) {
    const actions = resolved.entry.actions.get(role);

    for (const method of constants.METHODS) {
      if (actions?.[method]?.enabled === true) enabled.add(method);
    }
  } else {
    for (const [sourceId, grant] of resolved.entry.grants) {
      if (!identity.assigned.has(sourceId)) continue;

      for (const method of Object.keys(grant.actions)) enabled.add(method);
    }
  }

  const map: Record<string, boolean> = Object.create(null);

  for (const method of constants.METHODS) map[method] = enabled.has(method);

  return Object.freeze(map) as MethodAccessMap;
}
