import { getOrCreateState } from './state';
import { validateContextKey, validateRoleCatalog } from './validators';

function setRoles(key: 'roles', roles: readonly string[]): void {
  validateContextKey(key);

  const state = getOrCreateState();

  validateRoleCatalog(roles, state);

  state.roles = new Set(roles);
}

function getRoles(key: 'roles'): readonly string[] {
  validateContextKey(key);

  return [...getOrCreateState().roles];
}

export const context = Object.freeze({ set: setRoles, get: getRoles });
