import { GENERAL_ROLE } from './constants';
import { getOrCreateState } from './state';
import { validateContextKey, validateRoleCatalog } from './Validators';

function setRoles(key: 'roles', roles: readonly string[]): void {
  validateContextKey(key);
  const state = getOrCreateState();
  validateRoleCatalog(roles, state);
  state.roles = new Set([GENERAL_ROLE, ...roles]);
}

function getRoles(key: 'roles'): readonly string[] {
  validateContextKey(key);
  return [...getOrCreateState().roles];
}

export const context = { set: setRoles, get: getRoles };
