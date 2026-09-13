import { checkAssignments } from '../../server/assignments';
import { authorizeWrite } from '../../server/authorize';
import { deny, invalidBody, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { SETTINGS_ALL } from './resources';
import { findUser, replaceUserPermissions } from './store';

const PERMISSIONS_MUST_BE_STRINGS = 'permissions must be an array of strings';

interface AssignPermissionsRequest {
  readonly identity: Identity;
  readonly userId: string;
  readonly permissions: unknown;
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function assignPermissionsToUser(request: AssignPermissionsRequest): Promise<UseCaseResult<Identity>> {
  const authorization = await authorizeWrite({ guard: SETTINGS_ALL.guard, identity: request.identity, method: 'update', data: {} });
  if (!authorization.isAllowed) return deny(authorization.errors);
  if (!isStringList(request.permissions)) return invalidBody(PERMISSIONS_MUST_BE_STRINGS);
  const target = findUser(request.userId);
  if (target === undefined) return notFound();
  const assignmentErrors = checkAssignments(target.role, request.permissions);
  if (assignmentErrors.length > 0) return deny(assignmentErrors);
  const updated = replaceUserPermissions(request.userId, request.permissions);
  if (updated === undefined) return notFound();
  return succeed(updated);
}
