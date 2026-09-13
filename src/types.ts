import type { ALL_FIELDS, METHODS } from './constants';

export interface RoleRegistry {
  general: true;
}

export type Role = keyof RoleRegistry & string;

export type Method = (typeof METHODS)[number];

export type Properties = readonly string[] | typeof ALL_FIELDS;

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

export interface Authorization {
  readonly direct: boolean;
  readonly grantedBy: readonly PermissionId[];
}

export interface ResolvedPermission {
  readonly role: Role;
  readonly action: string;
  readonly name: string;
  readonly permissionId: PermissionId;
  readonly method: Method;
  readonly enabled: true;
  readonly properties: Properties;
  readonly authorization: Authorization;
}

export type HookFn = (data: Data | undefined, context: Context | undefined, permission: ResolvedPermission) => unknown;

export type ValidationError =
  | { readonly code: Exclude<PkitErrorCode, 'PROPERTIES_NOT_ALLOWED'>; readonly message: string }
  | { readonly code: 'PROPERTIES_NOT_ALLOWED'; readonly message: string; readonly fields: readonly string[] }
  | { readonly code: 'HOOK_ERROR' | 'VALIDATION_ERROR'; readonly message: string; readonly cause: unknown };

export type ValidationErrorCode = ValidationError['code'];

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
  | 'PERMISSION_ROLE_MISMATCH'
  | 'PERMISSION_NOT_ASSIGNED'
  | 'METHOD_DISABLED'
  | 'PROPERTIES_NOT_ALLOWED';

export interface UserAssignments {
  role: Role;
  permissions: readonly string[];
}

interface PermissionInput extends UserAssignments {
  action: string;
  name: string;
  context?: Context;
}

export interface FindInput extends PermissionInput {
  method: 'find';
  select?: readonly string[];
  data?: Data;
}

export interface WriteInput<RequestData extends Data = Data> extends PermissionInput {
  method: Exclude<Method, 'find'>;
  data: RequestData;
}

export type ValidateInput = FindInput | WriteInput;

export type FindResult = Properties;

export type ValidateResult<Result> =
  | { readonly result: Result; readonly errors: readonly [] }
  | { readonly result: null; readonly errors: readonly ValidationError[] };

export type PermissionEntry = Readonly<ActionDef>;

export type NamedPermissionCatalog = Readonly<Record<PermissionId, Readonly<Partial<Record<Method, PermissionEntry>>>>>;

export type MethodAccessMap = Readonly<Record<Method, boolean>>;

export type UserPermissionMap = Readonly<Record<PermissionId, MethodAccessMap>>;
