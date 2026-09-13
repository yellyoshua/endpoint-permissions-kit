import type { PkitError, ValidationError, ValidationErrorCode } from 'endpoint-permissions-kit';

export const HOOK_ERROR_CODE = 'HOOK_ERROR';
export const INTERNAL_CODE = 'INTERNAL';
export const NOT_FOUND_CODE = 'NOT_FOUND';
export const INVALID_BODY_CODE = 'INVALID_BODY';

export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message?: string;
    readonly fields?: readonly string[];
    readonly reasons?: readonly string[];
  };
}

export interface HttpError {
  readonly status: number;
  readonly body: ErrorBody;
}

export type Failure =
  | { readonly kind: 'denied'; readonly errors: readonly ValidationError[] }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'invalid-body'; readonly message: string };

export type UseCaseResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly failure: Failure };

export function succeed<Value>(value: Value): UseCaseResult<Value> {
  return { ok: true, value };
}

export function deny(errors: readonly ValidationError[]): UseCaseResult<never> {
  return { ok: false, failure: { kind: 'denied', errors } };
}

export function notFound(): UseCaseResult<never> {
  return { ok: false, failure: { kind: 'not-found' } };
}

export function invalidBody(message: string): UseCaseResult<never> {
  return { ok: false, failure: { kind: 'invalid-body', message } };
}

const FORBIDDEN_CODES: ReadonlySet<ValidationErrorCode> = new Set<ValidationErrorCode>([
  'PERMISSION_NOT_ASSIGNED',
  'METHOD_DISABLED',
  'PROPERTIES_NOT_ALLOWED',
  'UNKNOWN_ROLE',
  'PERMISSION_ROLE_MISMATCH',
  'UNKNOWN_PERMISSION',
]);

const CORRUPT_IDENTITY_CODES: ReadonlySet<ValidationErrorCode> = new Set<ValidationErrorCode>([
  'UNKNOWN_ROLE',
  'PERMISSION_ROLE_MISMATCH',
  'UNKNOWN_PERMISSION',
]);

function translateSingleError(error: ValidationError): HttpError {
  if (error.code === 'INVALID_INPUT') {
    return { status: 400, body: { error: { code: error.code, message: error.message } } };
  }
  if (error.code === 'PROPERTIES_NOT_ALLOWED') {
    return { status: 403, body: { error: { code: error.code, fields: error.fields } } };
  }
  if (CORRUPT_IDENTITY_CODES.has(error.code)) {
    console.error(`corrupt identity: ${error.code} ${error.message}`);
  }
  if (FORBIDDEN_CODES.has(error.code)) {
    return { status: 403, body: { error: { code: error.code } } };
  }
  console.error(`internal permission failure: ${error.code} ${error.message}`);
  return { status: 500, body: { error: { code: INTERNAL_CODE } } };
}

export function validationErrorsToHttp(errors: readonly ValidationError[]): HttpError {
  const hookErrors = errors.filter((error) => error.code === HOOK_ERROR_CODE);
  if (hookErrors.length === errors.length && errors.length > 0) {
    return { status: 403, body: { error: { code: HOOK_ERROR_CODE, reasons: hookErrors.map((error) => error.message) } } };
  }
  const [firstError] = errors;
  if (firstError === undefined) {
    console.error('validation reported failure without errors');
    return { status: 500, body: { error: { code: INTERNAL_CODE } } };
  }
  return translateSingleError(firstError);
}

export function isPkitError(error: unknown): error is PkitError {
  return error instanceof Error && error.name === 'PkitError';
}

export function thrownErrorToHttp(error: unknown): HttpError {
  if (!isPkitError(error)) {
    console.error('unexpected failure', error);
    return { status: 500, body: { error: { code: INTERNAL_CODE } } };
  }
  if (error.code === 'PROPERTIES_NOT_ALLOWED') {
    return translateSingleError({ code: error.code, message: error.message, fields: error.fields });
  }
  return translateSingleError({ code: error.code, message: error.message });
}

export function failureToHttp(failure: Failure): HttpError {
  if (failure.kind === 'denied') return validationErrorsToHttp(failure.errors);
  if (failure.kind === 'not-found') return { status: 404, body: { error: { code: NOT_FOUND_CODE } } };
  return { status: 400, body: { error: { code: INVALID_BODY_CODE, message: failure.message } } };
}
