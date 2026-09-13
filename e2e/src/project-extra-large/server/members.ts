import type { Data } from 'endpoint-permissions-kit';
import type { UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { createRecord } from './collection';
import { MEMBERS_ALL } from './resources';
import type { StoredRecord } from './store';

interface InviteMemberRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly data: Data;
}

export function inviteMember(request: InviteMemberRequest): Promise<UseCaseResult<StoredRecord>> {
  return createRecord({
    resource: MEMBERS_ALL,
    identity: request.identity,
    data: request.data,
    context: request.context,
    defaults: { invitedBy: request.identity.id },
  });
}

export function importMember(request: InviteMemberRequest): Promise<UseCaseResult<StoredRecord>> {
  return createRecord({ resource: MEMBERS_ALL, identity: request.identity, data: request.data, defaults: { invitedBy: 'import' } });
}
