import type { NameEntry, Snapshot } from './registry';
import type { Method, Properties } from './types';
import errors from './errors';
import identifiers from './identifiers';

export interface Identity {
  readonly assigned: ReadonlySet<string>;
  readonly names: ReadonlyMap<string, string>;
}

export interface ResolvedName {
  readonly name: string;
  readonly entry: NameEntry;
  readonly direct: boolean;
}

interface Access {
  readonly entry: NameEntry;
  readonly properties: Properties;
}

const resolve = {
  checkIdentity(snapshot: Snapshot, role: unknown, permissions: unknown): Identity {
    if (typeof role !== 'string') throw errors.create('INVALID_INPUT', 'role is required');

    if (!snapshot.roles.has(role)) throw errors.create('UNKNOWN_ROLE', `role "${role}" is not declared`);

    if (!Array.isArray(permissions)) throw errors.create('INVALID_INPUT', 'permissions must be an array of identifiers');

    const assigned = new Set<string>();
    const names = new Map<string, string>();

    for (const permissionId of permissions) {
      const reference = identifiers.parse(permissionId);

      if (reference === null) throw errors.create('INVALID_INPUT', `invalid permission identifier: ${errors.describe(permissionId)}`);

      if (reference.role !== role) {
        throw errors.create('PERMISSION_ROLE_MISMATCH', `"${reference.id}" belongs to role "${reference.role}", not the authenticated role "${role}"`);
      }

      if (!snapshot.assignable.has(reference.id)) throw errors.create('UNKNOWN_PERMISSION', `"${reference.id}" is not an assignable permission`);

      const held = names.get(reference.module);

      if (held !== undefined && held !== reference.name) {
        throw errors.create('AMBIGUOUS_PERMISSION', `"${reference.id}" and "${identifiers.build(role, reference.module, held)}" are both assigned: a request names no permission name, so module "${reference.module}" cannot be resolved`);
      }

      assigned.add(reference.id);
      names.set(reference.module, reference.name);
    }

    return { assigned, names };
  },

  resolveName(snapshot: Snapshot, role: string, modulePath: string, identity: Identity): ResolvedName | null {
    const moduleEntry = snapshot.modules.get(modulePath);

    if (moduleEntry === undefined) throw errors.create('UNKNOWN_ACTION', `module "${modulePath}" is not registered`);

    const held = identity.names.get(modulePath);

    if (held !== undefined) {
      const entry = moduleEntry.names.get(held);

      if (entry === undefined) return null;

      return { name: held, entry, direct: true };
    }

    let reached: ResolvedName | null = null;

    for (const sourceId of identity.assigned) {
      const names = snapshot.grantsBySource.get(sourceId)?.get(modulePath);

      if (names === undefined) continue;

      for (const name of names) {
        if (reached !== null && reached.name !== name) {
          throw errors.create('AMBIGUOUS_PERMISSION', `grants reach "${identifiers.build(role, modulePath, reached.name)}" and "${identifiers.build(role, modulePath, name)}": a request names no permission name, so module "${modulePath}" cannot be resolved`);
        }

        const entry = moduleEntry.names.get(name);

        if (entry !== undefined) reached = { name, entry, direct: false };
      }
    }

    return reached;
  },

  resolveAccess(snapshot: Snapshot, role: string, modulePath: string, method: Method, identity: Identity): Access {
    const resolved = resolve.resolveName(snapshot, role, modulePath, identity);

    if (resolved === null) {
      throw errors.create('PERMISSION_NOT_ASSIGNED', `no name of module "${modulePath}" is assigned or granted to role "${role}" by the user permissions`);
    }

    const permissionId = identifiers.build(role, modulePath, resolved.name);

    if (resolved.direct) {
      const definition = resolved.entry.actions.get(role)?.[method];

      if (definition === undefined || !definition.enabled) throw errors.create('METHOD_DISABLED', `"${permissionId}.${method}" is not enabled`);

      return { entry: resolved.entry, properties: definition.properties };
    }

    const fields = new Set<string>();

    let isGranted = false;

    for (const [sourceId, grant] of resolved.entry.grants) {
      if (!identity.assigned.has(sourceId)) continue;

      const block = grant.actions[method];

      if (block === undefined) continue;

      isGranted = true;

      for (const field of block.properties) fields.add(field);
    }

    if (!isGranted) throw errors.create('METHOD_DISABLED', `"${permissionId}.${method}" is not granted`);

    return { entry: resolved.entry, properties: Object.freeze([...fields]) };
  },
};

export default resolve;
