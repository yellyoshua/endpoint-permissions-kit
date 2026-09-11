import { context } from './context';
import { defineModule } from './registry';
import { seal } from './seal';
import { permissions } from './permissions';
import { validate } from './validate';

export type {
  ActionDef,
  ActionDefs,
  Context,
  Data,
  FindInput,
  FindResult,
  HookFn,
  Method,
  PermissionCatalog,
  PermissionEntry,
  PkitErrorCode,
  Properties,
  ResolvedPermission,
  Role,
  RolePermissionMap,
  RoleRegistry,
  ValidateInput,
  ValidateResult,
  ValidationError,
  ValidationErrorCode,
  WriteInput,
} from './types';
export { METHODS } from './constants';
export type { PkitError } from './errors';
export type { ModuleBuilder, RoleBuilder } from './registry';
export { context, seal, permissions, validate, defineModule as module };

export const pkit = Object.freeze({ context, module: defineModule, seal, permissions, validate });
export default pkit;
