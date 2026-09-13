import pkit from 'endpoint-permissions-kit';
import type { Context, Data, FindResult, Method, ValidateResult, ValidationError } from 'endpoint-permissions-kit';
import type { Identity } from './identity';

export interface Guard {
  readonly action: string;
  readonly name: string;
}

interface AuthorizeBase {
  readonly guard: Guard;
  readonly identity: Identity;
  readonly context?: Context;
}

export interface AuthorizeFindRequest extends AuthorizeBase {
  readonly select?: readonly string[];
}

export interface AuthorizeWriteRequest extends AuthorizeBase {
  readonly method: Exclude<Method, 'find'>;
  readonly data: Data;
}

export type Authorization<Result> =
  | { readonly isAllowed: true; readonly result: Result }
  | { readonly isAllowed: false; readonly errors: readonly ValidationError[] };

function toAuthorization<Result>(validation: ValidateResult<Result>): Authorization<Result> {
  if (validation.result === null) return { isAllowed: false, errors: validation.errors };
  return { isAllowed: true, result: validation.result };
}

export async function authorizeFind(request: AuthorizeFindRequest): Promise<Authorization<FindResult>> {
  const validation = await pkit.validate({
    action: request.guard.action,
    name: request.guard.name,
    method: 'find',
    role: request.identity.role,
    permissions: request.identity.permissions,
    select: request.select,
    context: request.context,
  });
  return toAuthorization(validation);
}

export async function authorizeWrite(request: AuthorizeWriteRequest): Promise<Authorization<Data>> {
  const validation = await pkit.validate({
    action: request.guard.action,
    name: request.guard.name,
    method: request.method,
    role: request.identity.role,
    permissions: request.identity.permissions,
    data: request.data,
    context: request.context,
  });
  return toAuthorization(validation);
}

export function projectRecord(record: object, selection: FindResult): Data {
  const source = record as Data;
  if (selection === '*') return source;
  const projected: Data = {};
  for (const field of selection) {
    if (field in source) projected[field] = source[field];
  }
  return projected;
}
