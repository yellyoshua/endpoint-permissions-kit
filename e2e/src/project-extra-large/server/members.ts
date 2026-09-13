import type { Data } from 'endpoint-permissions-kit';
import type { UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { createRecord } from './collection';
import { MEMBERS_ALL } from './resources';
import { tenants, type StoredRecord } from './store';

interface InviteMemberRequest {
  readonly identity: Identity;
  readonly data: Data;
}

export function inviteMember(request: InviteMemberRequest): Promise<UseCaseResult<StoredRecord>> {
  return createRecord({
    resource: MEMBERS_ALL,
    identity: request.identity,
    data: request.data,
    context: { user: { id: request.identity.id }, tenantIds: tenants.list().map((tenant) => tenant.id) },
    defaults: { invitedBy: request.identity.id },
  });
}

export function importMember(request: InviteMemberRequest): Promise<UseCaseResult<StoredRecord>> {
  return createRecord({ resource: MEMBERS_ALL, identity: request.identity, data: request.data, defaults: { invitedBy: 'import' } });
}
