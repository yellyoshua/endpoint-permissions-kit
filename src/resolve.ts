import type { ActionDef, Method, Role } from './types';
import type { ModuleEntry } from './state';
import { GENERAL_ROLE } from './constants';

export function resolveAction(registeredModule: ModuleEntry, role: string, method: Method): ActionDef | undefined {
  return registeredModule.actions.get(role)?.[method] ?? registeredModule.actions.get(GENERAL_ROLE)?.[method];
}

export function resolveRole(role: Role | undefined): Role {
  return role === undefined ? GENERAL_ROLE : role;
}
