import constants from './constants';
import definitions from './definitions';
import errors from './errors';
import identifiers from './identifiers';
import state from './state';
import type { ModuleEntry, NameEntry, State } from './state';
import type { ActionDefs, GrantDefs, HookFn, Method, PermissionId, Role } from './types';

export interface ModuleBuilder {
  module(segment: string): ModuleBuilder;
  name(name: string): NameBuilder;
  hook(method: Method, hook: HookFn): ModuleBuilder;
}

export interface NameBuilder {
  role(role: Role): RoleBuilder;
  grantTo(permissionId: PermissionId): GrantBuilder;
  hook(method: Method, hook: HookFn): NameBuilder;
}

export interface RoleBuilder {
  registerActions(actions: ActionDefs): RoleBuilder;
  hook(method: Method, hook: HookFn): RoleBuilder;
}

export interface GrantBuilder {
  registerActions(actions: GrantDefs): GrantBuilder;
}

interface ModuleScope {
  action: string;
  builder: ModuleBuilder;
}

/** `role` is `*` on a name-wide scope, which owns the hooks that run for every role. */
interface NameScope<Builder> {
  action: string;
  name: string;
  role: string;
  builder: Builder;
}

interface GrantScope {
  action: string;
  name: string;
  permissionId: string;
  builder: GrantBuilder;
}

const registry = {
  defineModule(segment: string): ModuleBuilder {
    identifiers.checkModuleSegment(segment);

    return createModuleBuilder(segment);
  },
};

function createModuleBuilder(action: string): ModuleBuilder {
  const builder = {} as ModuleBuilder;
  const scope = { action, builder };

  return Object.assign(builder, {
    module: appendModule.bind(null, action),
    name: createNameBuilder.bind(null, action),
    hook: registerModuleHook.bind(null, scope),
  });
}

function appendModule(parentAction: string, segment: string): ModuleBuilder {
  identifiers.checkModuleSegment(segment);

  return createModuleBuilder(`${parentAction}${constants.MODULE_SEPARATOR}${segment}`);
}

function createNameBuilder(action: string, name: string): NameBuilder {
  identifiers.checkName(name);

  const builder = {} as NameBuilder;
  const scope = { action, name, role: constants.GLOBAL_HOOK_OWNER, builder };

  return Object.assign(builder, {
    role: createRoleBuilder.bind(null, action, name),
    grantTo: createGrantBuilder.bind(null, action, name),
    hook: (registerNameHook<NameBuilder>).bind(null, scope),
  });
}

function createRoleBuilder(action: string, name: string, role: string): RoleBuilder {
  identifiers.checkRole(role);

  const builder = {} as RoleBuilder;
  const scope = { action, name, role, builder };

  return Object.assign(builder, {
    registerActions: registerActions.bind(null, scope),
    hook: (registerNameHook<RoleBuilder>).bind(null, scope),
  });
}

function createGrantBuilder(action: string, name: string, permissionId: string): GrantBuilder {
  const builder = {} as GrantBuilder;
  const scope = { action, name, permissionId, builder };

  return Object.assign(builder, { registerActions: registerGrant.bind(null, scope) });
}

function registerActions(scope: NameScope<RoleBuilder>, actions: ActionDefs): RoleBuilder {
  const currentState = state.getOrCreate();

  state.requireOpen(currentState);
  requireDeclaredRole(scope.role, currentState.roles);

  if (currentState.modules.get(scope.action)?.names.get(scope.name)?.actions.has(scope.role)) {
    throw errors.create('DUPLICATE_REGISTRATION', `"${scope.action}::${scope.name}" already has actions registered for role "${scope.role}"`);
  }

  const registeredActions = definitions.readActions(actions, `${scope.action}::${scope.name} [${scope.role}]`);

  ensureName(currentState, scope.action, scope.name).actions.set(scope.role, registeredActions);

  return scope.builder;
}

function registerGrant(scope: GrantScope, actions: GrantDefs): GrantBuilder {
  const currentState = state.getOrCreate();

  state.requireOpen(currentState);

  // The referenced permission need not exist yet: seal() checks it, so grants may
  // be registered before the module they enable has been imported.
  const source = identifiers.parse(scope.permissionId, 'INVALID_DEFINITION',
    `"${scope.action}::${scope.name}": invalid grantTo identifier`,
  );

  requireDeclaredRole(source.role, currentState.roles);

  if (source.action === scope.action && source.name === scope.name) {
    throw errors.create('INVALID_DEFINITION', `"${scope.permissionId}" cannot grant to itself`);
  }

  if (currentState.modules.get(scope.action)?.names.get(scope.name)?.grants.has(scope.permissionId)) {
    throw errors.create('DUPLICATE_REGISTRATION', `"${scope.action}::${scope.name}" already has a grant for "${scope.permissionId}"`);
  }

  const grantActions = definitions.readGrant(actions, `${scope.action}::${scope.name} [grantTo ${scope.permissionId}]`);

  ensureName(currentState, scope.action, scope.name).grants.set(scope.permissionId, { source, actions: grantActions });

  return scope.builder;
}

function registerModuleHook(scope: ModuleScope, method: Method, hook: HookFn): ModuleBuilder {
  const currentState = state.getOrCreate();

  state.requireOpen(currentState);
  checkHook(hook, method, scope.action);

  appendHook(ensureModule(currentState, scope.action).hooks, method, hook);

  return scope.builder;
}

function registerNameHook<Builder>(scope: NameScope<Builder>, method: Method, hook: HookFn): Builder {
  const currentState = state.getOrCreate();

  state.requireOpen(currentState);

  if (scope.role !== constants.GLOBAL_HOOK_OWNER) requireDeclaredRole(scope.role, currentState.roles);

  checkHook(hook, method, `${scope.action}::${scope.name}`);

  const nameEntry = ensureName(currentState, scope.action, scope.name);
  const roleHooks = nameEntry.hooks.get(scope.role) ?? new Map<Method, HookFn[]>();

  nameEntry.hooks.set(scope.role, roleHooks);

  appendHook(roleHooks, method, hook);

  return scope.builder;
}

function checkHook(hook: unknown, method: Method, permissionPath: string): void {
  definitions.checkMethod(method, 'INVALID_DEFINITION', permissionPath);

  if (typeof hook !== 'function') throw errors.create('INVALID_DEFINITION', `${permissionPath}: hook("${method}") expects a function`);
}

function requireDeclaredRole(role: string, roles: ReadonlySet<string>): void {
  if (roles.has(role)) return;

  throw errors.create('ROLE_NOT_DECLARED',
    `role "${role}" is not declared. Available roles: ${[...roles].join(', ')}.\n` +
    "Is pkit.context.set('roles', [...]) missing from pkit.config.js, or was it imported after this file?",
  );
}

function ensureModule(currentState: State, action: string): ModuleEntry {
  const registeredModule = currentState.modules.get(action);

  if (registeredModule) return registeredModule;

  const newModule: ModuleEntry = { names: new Map(), hooks: new Map() };

  currentState.modules.set(action, newModule);

  return newModule;
}

function ensureName(currentState: State, action: string, name: string): NameEntry {
  const registeredModule = ensureModule(currentState, action);
  const registeredName = registeredModule.names.get(name);

  if (registeredName) return registeredName;

  const newName: NameEntry = { actions: new Map(), grants: new Map(), hooks: new Map() };

  registeredModule.names.set(name, newName);

  return newName;
}

function appendHook(methodHooks: Map<Method, HookFn[]>, method: Method, hook: HookFn): void {
  const hooks = methodHooks.get(method) ?? [];

  methodHooks.set(method, hooks);
  hooks.push(hook);
}

export default registry;
