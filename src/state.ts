import type { ActionDefs, GrantDefs, HookFn, Method, NamedPermissionCatalog } from './types';
import { GENERAL_ROLE } from './constants';

export interface PermissionReference {
  readonly role: string;
  readonly action: string;
  readonly name: string;
}

export interface GrantEntry {
  readonly source: PermissionReference;
  readonly actions: GrantDefs;
}

export interface NameEntry {
  readonly actions: Map<string, ActionDefs>;
  readonly grants: Map<string, GrantEntry>;
  readonly hooks: Map<string, Map<Method, HookFn[]>>;
}

export interface ModuleEntry {
  readonly names: Map<string, NameEntry>;
  readonly hooks: Map<Method, HookFn[]>;
}

interface Snapshot {
  readonly named: NamedPermissionCatalog;
  readonly assignable: ReadonlySet<string>;
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
