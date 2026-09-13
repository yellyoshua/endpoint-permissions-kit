import type { ActionDefs, GrantDefs, HookFn, Method, PermissionId, Role } from './types';
import { GLOBAL_HOOK_OWNER, MODULE_SEPARATOR } from './constants';
import { getOrCreateState, type ModuleEntry, type NameEntry, type State } from './state';
import { validateActions, validateGrantActions, validateHook, validateModuleName, validatePermissionName, validateRoleSegment } from './Validators';

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

function appendHook(methodHooks: Map<Method, HookFn[]>, method: Method, hook: HookFn): void {
  const hooks = methodHooks.get(method) ?? [];
  methodHooks.set(method, hooks);
  hooks.push(hook);
}

function registerActions(scope: NameScope<RoleBuilder>, actions: ActionDefs): RoleBuilder {
  const state = getOrCreateState();
  const registeredActions = validateActions(actions, scope, state);

  ensureName(state, scope.action, scope.name).actions.set(scope.role, registeredActions);

  return scope.builder;
}

function registerGrant(scope: GrantScope, actions: GrantDefs): GrantBuilder {
  const state = getOrCreateState();
  const grant = validateGrantActions(actions, scope, state);

  ensureName(state, scope.action, scope.name).grants.set(scope.permissionId, grant);

  return scope.builder;
}

function registerModuleHook(scope: ModuleScope, method: Method, hook: HookFn): ModuleBuilder {
  const state = getOrCreateState();
  validateHook(hook, { action: scope.action, method }, state);

  appendHook(ensureModule(state, scope.action).hooks, method, hook);

  return scope.builder;
}

function registerNameHook<Builder>(scope: NameScope<Builder>, method: Method, hook: HookFn): Builder {
  const state = getOrCreateState();
  validateHook(hook, { ...scope, method }, state);

  const nameEntry = ensureName(state, scope.action, scope.name);
  const roleHooks = nameEntry.hooks.get(scope.role) ?? new Map<Method, HookFn[]>();
  nameEntry.hooks.set(scope.role, roleHooks);

  appendHook(roleHooks, method, hook);

  return scope.builder;
}

function createRoleBuilder(action: string, name: string, role: string): RoleBuilder {
  validateRoleSegment(role);

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

function createNameBuilder(action: string, name: string): NameBuilder {
  validatePermissionName(name);

  const builder = {} as NameBuilder;
  const scope = { action, name, role: GLOBAL_HOOK_OWNER, builder };

  return Object.assign(builder, {
    role: createRoleBuilder.bind(null, action, name),
    grantTo: createGrantBuilder.bind(null, action, name),
    hook: (registerNameHook<NameBuilder>).bind(null, scope),
  });
}

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
  validateModuleName(segment);

  return createModuleBuilder(`${parentAction}${MODULE_SEPARATOR}${segment}`);
}

export function defineModule(segment: string): ModuleBuilder {
  validateModuleName(segment);

  return createModuleBuilder(segment);
}

function ensureModule(state: State, action: string): ModuleEntry {
  const registeredModule = state.modules.get(action);
  if (registeredModule) return registeredModule;

  const newModule: ModuleEntry = { names: new Map(), hooks: new Map() };
  state.modules.set(action, newModule);

  return newModule;
}

function ensureName(state: State, action: string, name: string): NameEntry {
  const registeredModule = ensureModule(state, action);
  const registeredName = registeredModule.names.get(name);
  if (registeredName) return registeredName;

  const newName: NameEntry = { actions: new Map(), grants: new Map(), hooks: new Map() };
  registeredModule.names.set(name, newName);

  return newName;
}
