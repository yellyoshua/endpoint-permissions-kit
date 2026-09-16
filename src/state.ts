import type { PermissionReference } from './identifiers';
import type { ActionDefs, GrantDefs, HookFn, Method, NamedPermissionCatalog } from './types';
import constants from './constants';
import errors from './errors';

interface GrantEntry {
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

export interface Snapshot {
  readonly named: NamedPermissionCatalog;
  readonly assignable: ReadonlySet<string>;
}

export interface State {
  roles: Set<string>;
  cropper: boolean;
  reservedFields: readonly string[];
  readonly modules: Map<string, ModuleEntry>;
  snapshot: Snapshot | null;
}

const STATE_KEY = Symbol.for('endpoint-permissions-kit');

const state = {
  getOrCreate(): State {
    const stateHost = globalThis as typeof globalThis & { [STATE_KEY]?: State };

    if (stateHost[STATE_KEY] === undefined) {
      stateHost[STATE_KEY] = {
        roles: new Set([constants.GENERAL_ROLE]),
        cropper: false,
        reservedFields: [],
        modules: new Map(),
        snapshot: null,
      };
    }

    return stateHost[STATE_KEY];
  },

  requireOpen(currentState: State): void {
    if (currentState.snapshot) throw errors.create('SEALED', 'pkit.seal() was already called: no more registrations allowed');
  },

  requireSnapshot(currentState: State): Snapshot {
    if (currentState.snapshot === null) {
      throw errors.create('NOT_SEALED', 'pkit.seal() has not been called: call it after importing every permission file');
    }

    return currentState.snapshot;
  },
};

export default state;
