import { context } from './context';
import { defineModule } from './registry';
import { seal } from './seal';
import { permissions } from './permissions';
import { validate } from './validate';

export type {
  ActionDef,
  ActionDefs,
  Authorization,
  Context,
  Data,
  FindInput,
  FindResult,
  GrantDef,
  GrantDefs,
  HookFn,
  Method,
  MethodAccessMap,
  NamedPermissionCatalog,
  PermissionEntry,
  PermissionId,
  PkitErrorCode,
  Properties,
  ResolvedPermission,
  Role,
  RoleRegistry,
  UserAssignments,
  UserPermissionMap,
  ValidateInput,
  ValidateResult,
  ValidationError,
  ValidationErrorCode,
  WriteInput,
} from './types';
export { METHODS } from './constants';
export type { PkitError } from './errors';
export type { GrantBuilder, ModuleBuilder, NameBuilder, RoleBuilder } from './registry';
export { context, seal, permissions, validate, defineModule as module };

export const pkit = Object.freeze({ context, module: defineModule, seal, permissions, validate });
export default pkit;
