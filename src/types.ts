import type { ALL_FIELDS, METHODS } from './constants';

export interface RoleRegistry {
  general: true;
}

export type Role = keyof RoleRegistry & string;

export type Method = (typeof METHODS)[number];

export type Properties = readonly string[] | typeof ALL_FIELDS;

export interface ActionDef {
  enabled: boolean;
  properties: Properties;
}

export type ActionDefs = Partial<Record<Method, ActionDef>>;

export type Data = Record<string, unknown>;

export type Context = Record<string, unknown>;

export interface ResolvedPermission {
  readonly role: Role;
  readonly action: string;
  readonly method: Method;
  readonly enabled: true;
  readonly properties: Properties;
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
  | 'METHOD_DISABLED'
  | 'PROPERTIES_NOT_ALLOWED';

interface PermissionInput {
  action: string;
  role?: Role;
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

export type PermissionCatalog = Readonly<Record<Role, Readonly<Record<string, PermissionEntry>>>>;

export type RolePermissionMap = Readonly<Record<string, boolean>>;
