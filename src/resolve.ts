import type { Authorization, Method, PermissionId, Properties } from './types';
import type { NameEntry } from './state';
import { PERMISSION_ID_SEPARATOR } from './constants';

export type Access =
  | { readonly status: 'granted'; readonly properties: Properties; readonly authorization: Authorization }
  | { readonly status: 'disabled' }
  | { readonly status: 'unassigned' };

const DIRECT_AUTHORIZATION: Authorization = Object.freeze({ direct: true, grantedBy: Object.freeze([]) });

const DISABLED_ACCESS: Access = Object.freeze({ status: 'disabled' });

const UNASSIGNED_ACCESS: Access = Object.freeze({ status: 'unassigned' });

export function permissionIdOf(role: string, action: string, name: string): PermissionId {
  return [role, action, name].join(PERMISSION_ID_SEPARATOR) as PermissionId;
}

export function resolveAccess(nameEntry: NameEntry, permissionId: string, role: string, method: Method, assigned: ReadonlySet<string>): Access {
  if (assigned.has(permissionId)) return resolveDirectAccess(nameEntry, role, method);

  return resolveGrantedAccess(nameEntry, method, assigned);
}

function resolveDirectAccess(nameEntry: NameEntry, role: string, method: Method): Access {
  const definition = nameEntry.actions.get(role)?.[method];
  if (!definition?.enabled) return DISABLED_ACCESS;

  return { status: 'granted', properties: definition.properties, authorization: DIRECT_AUTHORIZATION };
}

function resolveGrantedAccess(nameEntry: NameEntry, method: Method, assigned: ReadonlySet<string>): Access {
  const grantedBy: PermissionId[] = [];
  const properties = new Set<string>();
  let reachable = false;

  for (const [enablingId, grant] of nameEntry.grants) {
    if (!assigned.has(enablingId)) continue;
    reachable = true;

    const definition = grant.actions[method];
    if (!definition) continue;

    grantedBy.push(enablingId as PermissionId);
    for (const field of definition.properties) properties.add(field);
  }

  if (grantedBy.length === 0) return reachable ? DISABLED_ACCESS : UNASSIGNED_ACCESS;

  const authorization: Authorization = Object.freeze({ direct: false, grantedBy: Object.freeze(grantedBy.sort()) });

  return { status: 'granted', properties: Object.freeze([...properties]), authorization };
}
