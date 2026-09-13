import type { Data } from 'endpoint-permissions-kit';
import { notFound, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { createRecord, listRecords } from './collection';
import { REPLIES_ALL } from './resources';
import { tickets, type StoredRecord } from './store';

export const INTERNAL_SCOPE = 'internal';

interface ListRepliesRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
  readonly scope?: string;
}

interface CreateReplyRequest {
  readonly identity: Identity;
  readonly data: Data;
}

export function listReplies(request: ListRepliesRequest): Promise<UseCaseResult<readonly Data[]>> {
  return listRecords({ resource: REPLIES_ALL, identity: request.identity, select: request.select, context: { isInternalScope: request.scope === INTERNAL_SCOPE } });
}

export async function createReply(request: CreateReplyRequest): Promise<UseCaseResult<StoredRecord>> {
  const ticket = tickets.find(String(request.data.ticketId ?? ''));
  if (ticket === undefined) return notFound();
  return createRecord({
    resource: REPLIES_ALL,
    identity: request.identity,
    data: request.data,
    context: { user: { id: request.identity.id }, ticket },
    defaults: { author: request.identity.id, internal: false },
  });
}
