import constants from './constants';
import context from './context';
import permissions from './permissions';
import registry from './registry';
import sealer from './seal';
import validator from './validate';

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
  Properties,
  Role,
  RoleRegistry,
  UserAssignments,
  UserPermissionMap,
  ValidateData,
  ValidateInput,
  ValidateResult,
  ValidationError,
  ValidationErrorCode,
} from './types';

export type { GrantBuilder, ModuleBuilder, NameBuilder, RoleBuilder } from './registry';

export const METHODS = constants.METHODS;

export const seal = sealer.seal;

export const validate = validator.validate;

const defineModule = registry.defineModule;

export { context, permissions, defineModule as module };

export const pkit = Object.freeze({ context, module: defineModule, seal, permissions, validate });

export default pkit;
