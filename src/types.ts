import type constants from './constants';

export interface RoleRegistry {
  general: true;
}

export type Role = keyof RoleRegistry & string;

export type Method = (typeof constants.METHODS)[number];

export type Properties = readonly string[] | typeof constants.ALL_FIELDS;

export type PermissionId = `${Role}::${string}::${string}`;

export interface ActionDef {
  enabled: boolean;
  properties: Properties;
}

export type ActionDefs = Partial<Record<Method, ActionDef>>;

export interface GrantDef {
  enabled: true;
  properties: readonly string[];
}

export type GrantDefs = Partial<Record<Method, GrantDef>>;

export type Data = Record<string, unknown>;

export type Context = Record<string, unknown>;

export type ContextValues = {
  roles: readonly string[];
  cropper: boolean;
};

export type ContextKey = keyof ContextValues;

export type HookFn = (data: Data, context: Context, permissions: readonly string[]) => unknown;

export type ValidationError =
  | { readonly code: Exclude<PkitErrorCode, 'PROPERTIES_NOT_ALLOWED'>; readonly message: string }
  | { readonly code: 'PROPERTIES_NOT_ALLOWED'; readonly message: string; readonly fields: readonly string[] }
  | { readonly code: 'HOOK_ERROR' | 'VALIDATION_ERROR'; readonly message: string; readonly cause: unknown };

export type ValidationErrorCode = ValidationError['code'];

export type PkitError = Error & { name: 'PkitError' } & (
  | { code: Exclude<PkitErrorCode, 'PROPERTIES_NOT_ALLOWED'> }
  | { code: 'PROPERTIES_NOT_ALLOWED'; fields: readonly string[] }
);

export type PkitErrorCode =
  | 'ROLE_NOT_DECLARED'
  | 'DUPLICATE_REGISTRATION'
  | 'INVALID_DEFINITION'
  | 'INVALID_INPUT'
  | 'SEALED'
  | 'NOT_SEALED'
  | 'UNKNOWN_ROLE'
  | 'UNKNOWN_ACTION'
  | 'UNKNOWN_PERMISSION'
  | 'AMBIGUOUS_PERMISSION'
  | 'PERMISSION_ROLE_MISMATCH'
  | 'PERMISSION_NOT_ASSIGNED'
  | 'METHOD_DISABLED'
  | 'PROPERTIES_NOT_ALLOWED';

export interface UserAssignments {
  role: Role;
  permissions: readonly string[];
}

export interface ValidateInput extends UserAssignments {
  action: string;
  method: Method;
  data?: Data;
  context?: Context;
}

export interface ValidateData {
  readonly data: Data;
}

export type ValidateResult =
  | { readonly result: ValidateData; readonly errors: readonly [] }
  | { readonly result: null; readonly errors: readonly ValidationError[] };

export type PermissionEntry = Readonly<ActionDef>;

export type NamedPermissionCatalog = Readonly<Record<PermissionId, Readonly<Partial<Record<Method, PermissionEntry>>>>>;

export type MethodAccessMap = Readonly<Record<Method, boolean>>;

export type UserPermissionMap = Readonly<Record<PermissionId, MethodAccessMap>>;
