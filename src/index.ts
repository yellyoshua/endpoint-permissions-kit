import constants from './constants';
import Pkit from './pkit';

export type {
  ActionDef,
  ActionDefs,
  Context,
  ContextKey,
  ContextValues,
  Data,
  GrantDef,
  GrantDefs,
  HookFn,
  Method,
  MethodAccessMap,
  NamedPermissionCatalog,
  PermissionEntry,
  PermissionId,
  PkitError,
  PkitErrorCode,
  PkitOptions,
  Properties,
  Role,
  UserAssignments,
  UserPermissionMap,
  ValidateData,
  ValidateInput,
  ValidateResult,
  ValidationError,
  ValidationErrorCode,
} from './types';

export type { default as ModuleBuilder } from './module-builder';
export type { default as NameBuilder } from './name-builder';
export type { default as RoleBuilder } from './role-builder';
export type { default as GrantBuilder } from './grant-builder';

export const METHODS = constants.METHODS;

export { Pkit };

export default Pkit;
