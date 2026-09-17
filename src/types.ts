import type constants from './constants';

export type Role<R extends string = string> = R;

export type Method = (typeof constants.METHODS)[number];

export type Properties = readonly string[] | typeof constants.ALL_FIELDS;

export type PermissionId<R extends string = string> = `${R}::${string}::${string}`;

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
  reservedFields: readonly string[];
};

export type ContextKey = keyof ContextValues;

export interface PkitOptions<R extends string> {
  roles?: readonly R[];
  cropper?: boolean;
  reservedFields?: readonly string[];
}

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
  | 'UNKNOWN_ROLE'
  | 'UNKNOWN_ACTION'
  | 'UNKNOWN_PERMISSION'
  | 'AMBIGUOUS_PERMISSION'
  | 'PERMISSION_ROLE_MISMATCH'
  | 'PERMISSION_NOT_ASSIGNED'
  | 'METHOD_DISABLED'
  | 'PROPERTIES_NOT_ALLOWED';

export interface UserAssignments<R extends string = string> {
  role: Role<R>;
  permissions: readonly string[];
}

export interface ValidateInput<R extends string = string> extends UserAssignments<R> {
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

export type NamedPermissionCatalog<R extends string = string> = Readonly<Record<PermissionId<R>, Readonly<Partial<Record<Method, PermissionEntry>>>>>;

export type MethodAccessMap = Readonly<Record<Method, boolean>>;

export type UserPermissionMap<R extends string = string> = Readonly<Record<PermissionId<R>, MethodAccessMap>>;
