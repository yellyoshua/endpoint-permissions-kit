import type { PermissionReference } from './identifiers';
import type { ActionDefs, GrantDefs, HookFn, Method, NamedPermissionCatalog, PkitOptions } from './types';
import constants from './constants';
import definitions from './definitions';
import errors from './errors';
import identifiers from './identifiers';

export interface GrantEntry {
  readonly source: PermissionReference;
  readonly actions: GrantDefs;
}

export interface NameEntry {
  readonly actions: Map<string, ActionDefs>;
  readonly grants: Map<string, GrantEntry>;
  readonly hooks: Map<Method, HookFn[]>;
  readonly roleHooks: Map<string, Map<Method, HookFn[]>>;
}

export interface ModuleEntry {
  readonly names: Map<string, NameEntry>;
  readonly hooks: Map<Method, HookFn[]>;
}

export interface Snapshot {
  readonly roles: ReadonlySet<string>;
  readonly named: NamedPermissionCatalog;
  readonly assignable: ReadonlySet<string>;
  readonly modules: ReadonlyMap<string, ModuleEntry>;
  readonly grantsBySource: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
}

export interface Registry {
  roles: ReadonlySet<string>;
  cropper: boolean;
  reservedFields: readonly string[];
  readonly modules: Map<string, ModuleEntry>;
  snapshot: Snapshot | null;
}

const registry = {
  create(options: PkitOptions<string>): Registry {
    const created: Registry = {
      roles: new Set([constants.GENERAL_ROLE]),
      cropper: false,
      reservedFields: Object.freeze([]),
      modules: new Map(),
      snapshot: null,
    };

    if (options.roles !== undefined) registry.setRoles(created, options.roles);
    if (options.cropper !== undefined) registry.setCropper(created, options.cropper);
    if (options.reservedFields !== undefined) registry.setReservedFields(created, options.reservedFields);

    return created;
  },

  setRoles(target: Registry, roles: unknown): void {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw errors.create('INVALID_DEFINITION', 'roles must be a non-empty array of role names');
    }

    const catalog = new Set<string>();

    for (const role of roles) catalog.add(identifiers.checkRoleLabel(role));

    target.roles = catalog;
    target.snapshot = null;
  },

  setCropper(target: Registry, cropper: unknown): void {
    if (typeof cropper !== 'boolean') {
      throw errors.create('INVALID_DEFINITION', `cropper must be a boolean, received ${errors.describe(cropper)}`);
    }

    target.cropper = cropper;
    target.snapshot = null;
  },

  setReservedFields(target: Registry, paths: unknown): void {
    target.reservedFields = definitions.readPropertyPaths(paths, 'reservedFields');
    target.snapshot = null;
  },

  checkRole(target: Registry, role: unknown): string {
    const label = identifiers.checkRoleLabel(role);

    if (!target.roles.has(label)) {
      throw errors.create('ROLE_NOT_DECLARED', `Role ${label} is not declared: pass it in the roles option of the Pkit constructor`);
    }

    return label;
  },

  registerActions(target: Registry, modulePath: string, name: string, role: string, literal: unknown): void {
    const actions = definitions.readActions(literal);
    const existing = target.modules.get(modulePath)?.names.get(name)?.actions.get(role);

    if (existing !== undefined) {
      throw errors.create('DUPLICATE_REGISTRATION', `${identifiers.build(role, modulePath, name)} already has registered actions`);
    }

    nameEntry(target, modulePath, name).actions.set(role, actions);
    target.snapshot = null;
  },

  registerGrant(target: Registry, modulePath: string, name: string, sourceId: unknown, literal: unknown): void {
    const source = identifiers.parse(sourceId);

    if (source === null) {
      throw errors.create('INVALID_DEFINITION', `Invalid grant identifier: ${errors.describe(sourceId)}`);
    }

    if (!target.roles.has(source.role)) {
      throw errors.create('ROLE_NOT_DECLARED', `Role ${source.role} of grant ${source.id} is not declared`);
    }

    if (source.module === modulePath && source.name === name) {
      throw errors.create('INVALID_DEFINITION', `Grant ${source.id} references its own permission`);
    }

    const actions = definitions.readGrant(literal);
    const existing = target.modules.get(modulePath)?.names.get(name)?.grants.get(source.id);

    if (existing !== undefined) {
      throw errors.create('DUPLICATE_REGISTRATION', `Grant from ${source.id} on ${modulePath}::${name} is already registered`);
    }

    nameEntry(target, modulePath, name).grants.set(source.id, Object.freeze({ source, actions }));
    target.snapshot = null;
  },

  registerModuleHook(target: Registry, modulePath: string, method: unknown, fn: unknown): void {
    const checked = checkHook(method, fn);

    pushHook(moduleEntry(target, modulePath).hooks, checked.method, checked.fn);
    target.snapshot = null;
  },

  registerNameHook(target: Registry, modulePath: string, name: string, method: unknown, fn: unknown): void {
    const checked = checkHook(method, fn);

    pushHook(nameEntry(target, modulePath, name).hooks, checked.method, checked.fn);
    target.snapshot = null;
  },

  registerRoleHook(target: Registry, modulePath: string, name: string, role: string, method: unknown, fn: unknown): void {
    const checked = checkHook(method, fn);
    const entry = nameEntry(target, modulePath, name);
    const perRole = entry.roleHooks.get(role) ?? new Map<Method, HookFn[]>();

    entry.roleHooks.set(role, perRole);
    pushHook(perRole, checked.method, checked.fn);
    target.snapshot = null;
  },
};

export default registry;

function moduleEntry(target: Registry, modulePath: string): ModuleEntry {
  const existing = target.modules.get(modulePath);

  if (existing !== undefined) return existing;

  const created: ModuleEntry = { names: new Map(), hooks: new Map() };

  target.modules.set(modulePath, created);

  return created;
}

function nameEntry(target: Registry, modulePath: string, name: string): NameEntry {
  const owner = moduleEntry(target, modulePath);
  const existing = owner.names.get(name);

  if (existing !== undefined) return existing;

  const created: NameEntry = { actions: new Map(), grants: new Map(), hooks: new Map(), roleHooks: new Map() };

  owner.names.set(name, created);

  return created;
}

function checkHook(method: unknown, fn: unknown): { method: Method; fn: HookFn } {
  if (typeof method !== 'string' || !(constants.METHODS as readonly string[]).includes(method)) {
    throw errors.create('INVALID_DEFINITION', `Unknown hook method: ${errors.describe(method)}`);
  }

  if (typeof fn !== 'function') {
    throw errors.create('INVALID_DEFINITION', `Hook for ${method} must be a function`);
  }

  return { method: method as Method, fn: fn as HookFn };
}

function pushHook(hooks: Map<Method, HookFn[]>, method: Method, fn: HookFn): void {
  const list = hooks.get(method) ?? [];

  hooks.set(method, list);
  list.push(fn);
}
