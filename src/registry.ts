import type { ActionDefs, HookFn, Method, Role } from './types';
import { GENERAL_ROLE, GLOBAL_HOOK_OWNER } from './constants';
import { getOrCreateState, type ModuleEntry, type State } from './state';
import { validateActions, validateHook, validateModuleName } from './Validators';

export interface RoleBuilder {
  registerActions(actions: ActionDefs): RoleBuilder;
  hook(method: Method, hook: HookFn): RoleBuilder;
}

export interface ModuleBuilder {
  module(moduleName: string): ModuleBuilder;
  role(role: Role): RoleBuilder;
  registerActions(actions: ActionDefs): RoleBuilder;
  hook(method: Method, hook: HookFn): ModuleBuilder;
}

interface RegistrationScope<Builder> {
  action: string;
  role: string;
  builder: Builder;
}

function registerActions(scope: RegistrationScope<RoleBuilder>, actions: ActionDefs): RoleBuilder {
  const state = getOrCreateState();
  const registeredActions = validateActions(actions, scope, state);
  const registeredModule = ensureModule(state, scope.action);
  registeredModule.actions.set(scope.role, registeredActions);
  return scope.builder;
}

function registerHook<Builder>(scope: RegistrationScope<Builder>, method: Method, hook: HookFn): Builder {
  const state = getOrCreateState();
  validateHook(hook, { ...scope, method }, state);
  const registeredModule = ensureModule(state, scope.action);
  let roleHooks = registeredModule.hooks.get(scope.role);
  if (!roleHooks) {
    roleHooks = new Map();
    registeredModule.hooks.set(scope.role, roleHooks);
  }
  let methodHooks = roleHooks.get(method);
  if (!methodHooks) {
    methodHooks = [];
    roleHooks.set(method, methodHooks);
  }
  methodHooks.push(hook);
  return scope.builder;
}

function createRoleBuilder(action: string, role: string): RoleBuilder {
  const builder = {} as RoleBuilder;
  const scope = { action, role, builder };
  return Object.assign(builder, {
    registerActions: registerActions.bind(null, scope),
    hook: (registerHook<RoleBuilder>).bind(null, scope),
  });
}

function createModuleBuilder(action: string): ModuleBuilder {
  const builder = {} as ModuleBuilder;
  const scope = { action, role: GLOBAL_HOOK_OWNER, builder };
  return Object.assign(builder, {
    module: appendModule.bind(null, action),
    role: createRoleBuilder.bind(null, action),
    registerActions: createRoleBuilder(action, GENERAL_ROLE).registerActions,
    hook: (registerHook<ModuleBuilder>).bind(null, scope),
  });
}

function appendModule(parentAction: string, moduleName: string): ModuleBuilder {
  validateModuleName(moduleName);
  return createModuleBuilder(`${parentAction}.${moduleName}`);
}

export function defineModule(moduleName: string): ModuleBuilder {
  validateModuleName(moduleName);
  return createModuleBuilder(moduleName);
}

function ensureModule(state: State, action: string): ModuleEntry {
  const registeredModule = state.modules.get(action);
  if (registeredModule) return registeredModule;
  const newModule: ModuleEntry = { actions: new Map(), hooks: new Map() };
  state.modules.set(action, newModule);
  return newModule;
}
