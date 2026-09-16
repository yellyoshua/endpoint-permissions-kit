import constants from './constants';
import errors from './errors';
import identifiers from './identifiers';
import state from './state';
import type { ModuleEntry, NameEntry } from './state';
import type { Method, NamedPermissionCatalog, PermissionEntry } from './types';

const sealer = {
  /**
   * Closes the registry: checks the references that could still be completed by
   * a later import, then materializes the views. Idempotent.
   */
  seal(): void {
    const currentState = state.getOrCreate();

    if (currentState.snapshot) return;

    checkRegistry(currentState.modules);

    const named: Record<string, Readonly<Partial<Record<Method, PermissionEntry>>>> = Object.create(null);

    for (const [action, registeredModule] of currentState.modules) {
      for (const [name, nameEntry] of registeredModule.names) {
        for (const [role, actions] of nameEntry.actions) {
          named[identifiers.build(role, action, name)] = actions;
        }
      }
    }

    currentState.snapshot = { named: Object.freeze(named) as NamedPermissionCatalog, assignable: new Set(Object.keys(named)) };
  },
};

function checkRegistry(modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [action, registeredModule] of modules) {
    if (registeredModule.names.size === 0) {
      throw errors.create('INVALID_DEFINITION', `"${action}" has hooks but no name with registered actions`);
    }

    for (const [name, nameEntry] of registeredModule.names) {
      const permissionPath = `${action}::${name}`;

      if (nameEntry.actions.size === 0) {
        throw errors.create('INVALID_DEFINITION', `"${permissionPath}" has no registered actions for any role`);
      }

      checkGrantReferences(permissionPath, nameEntry, modules);
      checkRoleHooks(permissionPath, nameEntry);
    }
  }
}

/**
 * A grant only works if its enabling identifier is assignable and if the name it
 * extends declares the granted methods for some role.
 */
function checkGrantReferences(permissionPath: string, nameEntry: NameEntry, modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [permissionId, grant] of nameEntry.grants) {
    const sourceEntry = modules.get(grant.source.action)?.names.get(grant.source.name);

    if (!sourceEntry?.actions.has(grant.source.role)) {
      throw errors.create('INVALID_DEFINITION', `"${permissionPath}": grantTo "${permissionId}" references a permission with no registered actions`);
    }

    for (const method of Object.keys(grant.actions)) {
      if (declaresMethod(nameEntry, method)) continue;

      throw errors.create('INVALID_DEFINITION',
        `"${permissionPath}": grantTo "${permissionId}" grants "${method}", which no role declares on that permission`,
      );
    }
  }
}

function declaresMethod(nameEntry: NameEntry, method: string): boolean {
  for (const actions of nameEntry.actions.values()) {
    if (Object.hasOwn(actions, method)) return true;
  }

  return false;
}

/** A role hook that no direct definition and no grant can ever reach is a configuration mistake. */
function checkRoleHooks(permissionPath: string, nameEntry: NameEntry): void {
  for (const [hookRole, methodHooks] of nameEntry.hooks) {
    if (hookRole === constants.GLOBAL_HOOK_OWNER) continue;

    for (const method of methodHooks.keys()) {
      if (hasAccessPath(nameEntry, hookRole, method)) continue;

      throw errors.create('INVALID_DEFINITION',
        `"${permissionPath}": hook for "${hookRole}" on "${method}" has no registered actions or grant for that role`,
      );
    }
  }
}

function hasAccessPath(nameEntry: NameEntry, role: string, method: Method): boolean {
  if (nameEntry.actions.get(role)?.[method]) return true;

  for (const grant of nameEntry.grants.values()) {
    if (grant.source.role === role && grant.actions[method]) return true;
  }

  return false;
}

export default sealer;
