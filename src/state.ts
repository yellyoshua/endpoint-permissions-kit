import type { ActionDefs, HookFn, Method, PermissionCatalog, RolePermissionMap } from './types';
import { GENERAL_ROLE } from './constants';

export interface ModuleEntry {
  readonly actions: Map<string, ActionDefs>;
  readonly hooks: Map<string, Map<Method, HookFn[]>>;
}

interface Snapshot {
  readonly all: PermissionCatalog;
  readonly byRole: ReadonlyMap<string, RolePermissionMap>;
}

export interface State {
  roles: Set<string>;
  readonly modules: Map<string, ModuleEntry>;
  snapshot: Snapshot | null;
}

export function getOrCreateState(): State {
  const stateKey = Symbol.for('endpoint-permissions-kit');
  const stateHost = globalThis as typeof globalThis & { [stateKey]?: State };
  if (stateHost[stateKey] === undefined) {
    stateHost[stateKey] = { roles: new Set([GENERAL_ROLE]), modules: new Map(), snapshot: null };
  }
  return stateHost[stateKey];
}
