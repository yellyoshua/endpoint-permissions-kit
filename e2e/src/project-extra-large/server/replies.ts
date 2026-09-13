import type { Data } from 'endpoint-permissions-kit';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { authorizeWrite } from '../../server/authorize';
import { listRecords } from './collection';
import { REPLIES_ALL } from './resources';
import { replies, tickets, type StoredRecord } from './store';

export const INTERNAL_SCOPE = 'internal';

interface ListRepliesRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
  readonly scope?: string;
}

interface CreateReplyRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly data: Data;
}

export function listReplies(request: ListRepliesRequest): Promise<UseCaseResult<readonly Data[]>> {
  return listRecords({ resource: REPLIES_ALL, identity: request.identity, select: request.select, context: { ...request.context, isInternalScope: request.scope === INTERNAL_SCOPE } });
}

export async function createReply(request: CreateReplyRequest): Promise<UseCaseResult<StoredRecord>> {
  const authorization = await authorizeWrite({ guard: REPLIES_ALL.guard, identity: request.identity, method: 'create', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const ticketId = String(authorization.result.ticketId ?? '');
  if (tickets.find(ticketId) === undefined) return notFound();
  const body = String(authorization.result.body ?? '');
  return succeed(replies.insert({ ticketId, body, author: request.identity.id, internal: false }));
}
