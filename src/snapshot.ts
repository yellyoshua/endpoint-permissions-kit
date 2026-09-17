import type { ModuleEntry, NameEntry, Registry, Snapshot } from './registry';
import type { ActionDefs, Method, NamedPermissionCatalog } from './types';
import errors from './errors';
import identifiers from './identifiers';

const snapshot = {
  of(target: Registry): Snapshot {
    if (target.snapshot !== null) return target.snapshot;

    const built = snapshot.build(target);

    target.snapshot = built;

    return built;
  },

  build(target: Registry): Snapshot {
    const named: Record<string, ActionDefs> = Object.create(null);

    for (const [modulePath, moduleEntry] of target.modules) {
      for (const [name, nameEntry] of moduleEntry.names) {
        for (const [role, actions] of nameEntry.actions) named[identifiers.build(role, modulePath, name)] = actions;
      }
    }

    const assignable = new Set(Object.keys(named));
    const grantsBySource = new Map<string, Map<string, string[]>>();

    for (const [modulePath, moduleEntry] of target.modules) checkModule(modulePath, moduleEntry, assignable, grantsBySource);

    return Object.freeze({
      named: Object.freeze(named) as NamedPermissionCatalog,
      assignable,
      modules: target.modules,
      grantsBySource,
      roles: target.roles,
    });
  },
};

export default snapshot;

function checkModule(modulePath: string, moduleEntry: ModuleEntry, assignable: ReadonlySet<string>, grantsBySource: Map<string, Map<string, string[]>>): void {
  if (moduleEntry.names.size === 0) {
    throw errors.create('INVALID_DEFINITION', `"${modulePath}" has hooks but no name with registered actions`);
  }

  for (const [name, nameEntry] of moduleEntry.names) {
    const permissionPath = `${modulePath}::${name}`;

    if (nameEntry.actions.size === 0) {
      throw errors.create('INVALID_DEFINITION', `"${permissionPath}" has no registered actions for any role`);
    }

    checkGrants(permissionPath, nameEntry, assignable);
    checkRoleHooks(permissionPath, nameEntry);

    for (const sourceId of nameEntry.grants.keys()) {
      const byModule = grantsBySource.get(sourceId) ?? new Map<string, string[]>();
      const names = byModule.get(modulePath) ?? [];

      grantsBySource.set(sourceId, byModule);
      byModule.set(modulePath, names);
      names.push(name);
    }
  }
}

function checkGrants(permissionPath: string, nameEntry: NameEntry, assignable: ReadonlySet<string>): void {
  for (const [sourceId, grant] of nameEntry.grants) {
    if (!assignable.has(sourceId)) {
      throw errors.create('INVALID_DEFINITION', `"${permissionPath}": grantTo "${sourceId}" references a permission with no registered actions`);
    }

    for (const method of Object.keys(grant.actions)) {
      if (declaresMethod(nameEntry, method)) continue;

      throw errors.create('INVALID_DEFINITION', `"${permissionPath}": grantTo "${sourceId}" grants "${method}", which no role declares on that permission`);
    }
  }
}

function declaresMethod(nameEntry: NameEntry, method: string): boolean {
  for (const actions of nameEntry.actions.values()) {
    if (Object.hasOwn(actions, method)) return true;
  }

  return false;
}

function checkRoleHooks(permissionPath: string, nameEntry: NameEntry): void {
  for (const [role, methodHooks] of nameEntry.roleHooks) {
    for (const method of methodHooks.keys()) {
      if (hasAccessPath(nameEntry, role, method)) continue;

      throw errors.create('INVALID_DEFINITION', `"${permissionPath}": hook for "${role}" on "${method}" has no registered actions or grant for that role`);
    }
  }
}

function hasAccessPath(nameEntry: NameEntry, role: string, method: Method): boolean {
  if (nameEntry.actions.get(role)?.[method] !== undefined) return true;

  for (const grant of nameEntry.grants.values()) {
    if (grant.source.role === role && grant.actions[method] !== undefined) return true;
  }

  return false;
}
