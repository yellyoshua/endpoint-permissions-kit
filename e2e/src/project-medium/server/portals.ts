import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { ALL_NAME, PORTALS_ACTION, UPDATE_ONLY_NAME } from './permissions';
import { deletePortal, findPortal, listPortals, replacePortal, type Portal } from './store';

const PORTALS_ALL = { action: PORTALS_ACTION, name: ALL_NAME };
const PORTALS_UPDATE_ONLY = { action: PORTALS_ACTION, name: UPDATE_ONLY_NAME };

interface ListPortalsRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
}

interface UpdatePortalRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly id: string;
  readonly data: Data;
}

interface RemovePortalRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly id: string;
}

export async function listAllPortals(request: ListPortalsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({
    guard: PORTALS_ALL,
    identity: request.identity,
    select: request.select,
    context: request.context,
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listPortals().map((portal) => projectRecord(portal, authorization.result)));
}

export async function listEditablePortals(request: ListPortalsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: PORTALS_UPDATE_ONLY, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listPortals().map((portal) => projectRecord(portal, authorization.result)));
}

export async function updateEditablePortal(request: UpdatePortalRequest): Promise<UseCaseResult<Portal>> {
  const authorization = await authorizeWrite({ guard: PORTALS_UPDATE_ONLY, identity: request.identity, method: 'update', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findPortal(request.id);
  if (existing === undefined) return notFound();
  const updated: Portal = {
    ...existing,
    name: typeof authorization.result.name === 'string' ? authorization.result.name : existing.name,
    assetId: typeof authorization.result.assetId === 'string' ? authorization.result.assetId : existing.assetId,
  };
  replacePortal(updated);
  return succeed(updated);
}

export async function removePortal(request: RemovePortalRequest): Promise<UseCaseResult<undefined>> {
  const authorization = await authorizeWrite({ guard: PORTALS_ALL, identity: request.identity, method: 'remove', data: { id: request.id }, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  if (findPortal(request.id) === undefined) return notFound();
  deletePortal(request.id);
  return succeed(undefined);
}
