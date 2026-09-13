import type { Data } from 'endpoint-permissions-kit';
import { checkAssignments } from '../../server/assignments';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ACCOUNTS_NAME, EMPLOYEES_ACTION } from './permissions';
import { findUser, listUsers, replaceUserPermissions } from './store';

const EMPLOYEES_ACCOUNTS = { action: EMPLOYEES_ACTION, name: ACCOUNTS_NAME };

interface ListAccountsRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface AssignPermissionsRequest {
  readonly identity: Identity;
  readonly userId: string;
  readonly data: Data;
  readonly permissions: readonly string[];
}

export function asPermissionList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((entry) => typeof entry === 'string')) return undefined;
  return value;
}

export async function listAccounts(request: ListAccountsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: EMPLOYEES_ACCOUNTS, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listUsers().map((user) => projectRecord(user, authorization.result)));
}

export async function assignPermissionsToUser(request: AssignPermissionsRequest): Promise<UseCaseResult<Identity>> {
  const authorization = await authorizeWrite({
    guard: EMPLOYEES_ACCOUNTS,
    identity: request.identity,
    method: 'update',
    data: request.data,
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const target = findUser(request.userId);
  if (target === undefined) return notFound();
  const assignmentErrors = checkAssignments(target.role, request.permissions);
  if (assignmentErrors.length > 0) return deny(assignmentErrors);
  const updated = replaceUserPermissions(target.id, request.permissions);
  if (updated === undefined) return notFound();
  return succeed(updated);
}
