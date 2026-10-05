import type { Snapshot } from './registry';
import type { Identity, ResolvedName } from './resolve';
import type { MethodAccessMap, NamedPermissionCatalog, PermissionId, RolePermissionAction, RolePermissionModule, RolePermissionTree, UserAssignments, UserPermissionMap } from './types';
import constants from './constants';
import errors from './errors';
import identifiers from './identifiers';
import resolve from './resolve';

interface ModuleDraft {
  readonly actions: RolePermissionAction[];
  readonly modules: Map<string, ModuleDraft>;
}

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

  forRole(snapshot: Snapshot, role: unknown): RolePermissionTree {
    resolve.checkIdentity(snapshot, role, []);

    const root: ModuleDraft = { actions: [], modules: new Map() };

    for (const permissionId of Object.keys(permissions.named(snapshot))) {
      const reference = identifiers.parse(permissionId);

      if (reference === null || reference.role !== role || reference.name === constants.NAME_FOR_ALL_USERS_PERMISSIONS) continue;

      const action: RolePermissionAction = { name: reference.name, identifier: reference.name, resourceName: reference.id as PermissionId };

      moduleDraft(root, reference.module).actions.push(Object.freeze(action));
    }

    return Object.freeze({ modules: moduleNodes(root.modules) });
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

function moduleDraft(root: ModuleDraft, modulePath: string): ModuleDraft {
  let draft = root;

  for (const segment of modulePath.split(constants.MODULE_SEPARATOR)) {
    const child = draft.modules.get(segment) ?? { actions: [], modules: new Map<string, ModuleDraft>() };

    draft.modules.set(segment, child);
    draft = child;
  }

  return draft;
}

function moduleNodes(drafts: ReadonlyMap<string, ModuleDraft>): readonly RolePermissionModule[] {
  const nodes: RolePermissionModule[] = [];

  for (const [segment, draft] of drafts) {
    const node = { name: segment, identifier: segment, actions: Object.freeze(draft.actions) };

    nodes.push(Object.freeze(draft.modules.size === 0 ? node : { ...node, modules: moduleNodes(draft.modules) }));
  }

  return Object.freeze(nodes);
}
