import pkit from 'endpoint-permissions-kit';
import type { Role, ValidationError } from 'endpoint-permissions-kit';
import { isPkitError } from './errors';

export function checkAssignments(role: Role, permissions: readonly string[]): readonly ValidationError[] {
  try {
    pkit.permissions.forUser({ role, permissions });
    return [];
  } catch (error) {
    if (!isPkitError(error) || error.code === 'PROPERTIES_NOT_ALLOWED') throw error;
    return [{ code: error.code, message: error.message }];
  }
}
