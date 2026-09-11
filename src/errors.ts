import type { PkitErrorCode } from './types';

export type PkitError = Error & { name: 'PkitError' } & (
  | { code: Exclude<PkitErrorCode, 'PROPERTIES_NOT_ALLOWED'> }
  | { code: 'PROPERTIES_NOT_ALLOWED'; fields: readonly string[] }
);

export function pkitError<ErrorCode extends PkitErrorCode>(code: ErrorCode, message: string): Error & {
  name: 'PkitError';
  code: ErrorCode;
} {
  return Object.assign(new Error(message), { name: 'PkitError' as const, code });
}
