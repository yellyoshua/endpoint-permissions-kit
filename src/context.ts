import errors from './errors';
import identifiers from './identifiers';
import properties from './properties';
import state from './state';
import type { ContextKey, ContextValues } from './types';

const context = Object.freeze({
  set<Key extends ContextKey>(key: Key, value: ContextValues[Key]): void {
    const contextKey = checkKey(key);

    const currentState = state.getOrCreate();

    state.requireOpen(currentState);

    if (contextKey === 'cropper') {
      if (typeof value !== 'boolean') throw errors.create('INVALID_DEFINITION', 'cropper must be a boolean');

      currentState.cropper = value;

      return;
    }

    if (contextKey === 'reservedFields') {
      currentState.reservedFields = Object.freeze(readReservedFields(value));

      return;
    }

    currentState.roles = new Set(readRoleCatalog(value, currentState.modules.size));
  },

  get<Key extends ContextKey>(key: Key): ContextValues[Key] {
    const contextKey = checkKey(key);

    const currentState = state.getOrCreate();

    if (contextKey === 'cropper') return currentState.cropper as ContextValues[Key];

    const paths: readonly string[] = contextKey === 'roles' ? [...currentState.roles] : [...currentState.reservedFields];

    return paths as ContextValues[Key];
  },
});

function checkKey(key: unknown): ContextKey {
  if (key === 'roles' || key === 'cropper' || key === 'reservedFields') return key;

  throw errors.create('INVALID_DEFINITION', `unknown context key: "${errors.describe(key)}"`);
}

function readRoleCatalog(value: unknown, registeredModuleCount: number): readonly string[] {
  if (registeredModuleCount > 0) {
    throw errors.create('INVALID_DEFINITION', 'roles must be declared before registering permissions: import pkit.config.js first');
  }

  if (!Array.isArray(value)) throw errors.create('INVALID_DEFINITION', 'roles must be an array of non-empty strings');

  for (const role of value) {
    if (typeof role !== 'string' || role.length === 0) {
      throw errors.create('INVALID_DEFINITION', 'roles must be an array of non-empty strings');
    }
  }

  const catalog = value as readonly string[];

  if (catalog.length === 0) throw errors.create('INVALID_DEFINITION', 'roles must declare at least one role');

  for (const role of catalog) identifiers.checkRole(role);

  return catalog;
}

function readReservedFields(value: unknown): string[] {
  if (!Array.isArray(value)) throw errors.create('INVALID_DEFINITION', 'reservedFields must be an array of property paths');

  const fields: string[] = [];

  for (const field of value) {
    if (typeof field !== 'string') throw errors.create('INVALID_DEFINITION', 'reservedFields must be an array of property paths');

    properties.checkDeclaredPath(field, 'reservedFields');

    fields.push(field);
  }

  return fields;
}

export default context;
