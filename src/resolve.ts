import constants from './constants';
import errors from './errors';
import identifiers from './identifiers';
import type { ModuleEntry, NameEntry, Snapshot } from './state';
import type { Method, MethodAccessMap, Properties, Role, UserAssignments } from './types';

/** The caller, with every assignment already checked against the sealed catalog. */
interface Identity {
  readonly role: Role;
  readonly assigned: ReadonlySet<string>;
  readonly names: ReadonlyMap<string, string>;
}

/** The single permission of a module an identity resolves to. */
interface ChosenPermission {
  readonly permissionId: string;
  readonly entry: NameEntry;
}

type Access =
  | { readonly status: 'granted'; readonly properties: Properties }
  | { readonly status: 'disabled' }
  | { readonly status: 'unassigned' };

const DISABLED_ACCESS: Access = Object.freeze({ status: 'disabled' });

const UNASSIGNED_ACCESS: Access = Object.freeze({ status: 'unassigned' });

const resolve = {
  /**
   * Checks the identity a request or a view arrives with. Every assignment must be
   * well formed, belong to the authenticated role and exist as assignable: one
   * stale row denies everything, so it cannot silently widen or narrow access.
   *
   * It also indexes the assignments by module. A request names no permission name,
   * so two names of the same module would leave the choice to the library: that is
   * `AMBIGUOUS_PERMISSION` and it denies everything.
   */
  identity(assignments: UserAssignments, snapshot: Snapshot, roles: ReadonlySet<string>): Identity {
    if (assignments === null || typeof assignments !== 'object') throw errors.create('INVALID_INPUT', 'assignments must be an object');

    const { role, permissions } = assignments;

    if (typeof role !== 'string') throw errors.create('INVALID_INPUT', 'role is required');

    if (!roles.has(role)) throw errors.create('UNKNOWN_ROLE', `role "${role}" is not declared`);

    if (!Array.isArray(permissions)) throw errors.create('INVALID_INPUT', 'permissions must be an array of strings');

    const assigned = new Set<string>();
    const names = new Map<string, string>();

    for (const permissionId of permissions) {
      const reference = identifiers.parse(permissionId, 'INVALID_INPUT', 'invalid permission identifier');

      if (reference.role !== role) {
        throw errors.create('PERMISSION_ROLE_MISMATCH', `"${permissionId}" belongs to role "${reference.role}", not the authenticated role "${role}"`);
      }

      if (!snapshot.assignable.has(permissionId)) {
        throw errors.create('UNKNOWN_PERMISSION', `"${permissionId}" is not an assignable permission`);
      }

      const assignedName = names.get(reference.action);

      if (assignedName !== undefined && assignedName !== reference.name) {
        throw errors.create('AMBIGUOUS_PERMISSION',
          `"${permissionId}" and "${identifiers.build(role, reference.action, assignedName)}" are both assigned: a request names no permission name, so module "${reference.action}" cannot be resolved`,
        );
      }

      assigned.add(permissionId);
      names.set(reference.action, reference.name);
    }

    return { role: role as Role, assigned, names };
  },

  /**
   * The permission of a module this identity resolves to. The request carries no
   * name, so a direct assignment on that module decides, and without one the only
   * name its grants reach does. `undefined` means the module is out of reach.
   *
   * Two reachable names deny with `AMBIGUOUS_PERMISSION`: picking one would widen
   * or narrow the access the user was given, without anyone asking for it.
   */
  permission(registeredModule: ModuleEntry, action: string, identity: Identity): ChosenPermission | undefined {
    const assignedName = identity.names.get(action);

    if (assignedName !== undefined) {
      const assignedEntry = registeredModule.names.get(assignedName);

      if (assignedEntry === undefined) return undefined;

      return { permissionId: identifiers.build(identity.role, action, assignedName), entry: assignedEntry };
    }

    let chosen: ChosenPermission | undefined;

    for (const [name, nameEntry] of registeredModule.names) {
      const permissionId = identifiers.build(identity.role, action, name);

      if (resolve.methodAccess(nameEntry, permissionId, identity.role, identity.assigned) === undefined) continue;

      if (chosen !== undefined) {
        throw errors.create('AMBIGUOUS_PERMISSION',
          `grants reach "${chosen.permissionId}" and "${permissionId}": a request names no permission name, so module "${action}" cannot be resolved`,
        );
      }

      chosen = { permissionId, entry: nameEntry };
    }

    return chosen;
  },

  /**
   * Decides one `(role, module, name, method)`. A direct assignment decides
   * completely and ignores grants; without it the applicable grants are combined.
   */
  access(nameEntry: NameEntry, permissionId: string, role: string, method: Method, assigned: ReadonlySet<string>): Access {
    if (!assigned.has(permissionId)) return grantedAccess(nameEntry, method, assigned);

    const definition = nameEntry.actions.get(role)?.[method];

    if (!definition?.enabled) return DISABLED_ACCESS;

    return { status: 'granted', properties: definition.properties };
  },

  /**
   * The four methods of one permission, for the read-only views.
   * Returns `undefined` when the permission is out of reach, which is how a view
   * distinguishes "not yours" from "yours but nothing enabled".
   *
   * Mirrors the precedence of `access` in a single pass over the grants, because a
   * view needs no fields. Any change to `access` belongs here too.
   */
  methodAccess(nameEntry: NameEntry, permissionId: string, role: string, assigned: ReadonlySet<string>): MethodAccessMap | undefined {
    const methodAccess: Record<string, boolean> = Object.create(null);

    if (assigned.has(permissionId)) {
      const actions = nameEntry.actions.get(role);

      for (const method of constants.METHODS) methodAccess[method] = actions?.[method]?.enabled === true;

      return Object.freeze(methodAccess) as MethodAccessMap;
    }

    const grantedMethods = new Set<string>();

    let isReachable = false;

    for (const [enablingId, grant] of nameEntry.grants) {
      if (!assigned.has(enablingId)) continue;

      isReachable = true;

      for (const method of Object.keys(grant.actions)) grantedMethods.add(method);
    }

    if (!isReachable) return undefined;

    for (const method of constants.METHODS) methodAccess[method] = grantedMethods.has(method);

    return Object.freeze(methodAccess) as MethodAccessMap;
  },
};

/**
 * Grants are one hop: only an identifier the user holds directly enables a block,
 * and the effective fields are the union of the blocks that declare the method.
 */
function grantedAccess(nameEntry: NameEntry, method: Method, assigned: ReadonlySet<string>): Access {
  const fields = new Set<string>();

  let isGranted = false;
  let isReachable = false;

  for (const [enablingId, grant] of nameEntry.grants) {
    if (!assigned.has(enablingId)) continue;

    isReachable = true;

    const definition = grant.actions[method];

    if (!definition) continue;

    isGranted = true;

    for (const field of definition.properties) fields.add(field);
  }

  if (!isGranted) return isReachable ? DISABLED_ACCESS : UNASSIGNED_ACCESS;

  return { status: 'granted', properties: Object.freeze([...fields]) };
}

export default resolve;
