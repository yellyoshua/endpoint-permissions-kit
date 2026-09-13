import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, PROFILE_ACTION } from './permissions';
import { findProfile, replaceProfile, type Profile } from './store';

const PROFILE_ALL = { action: PROFILE_ACTION, name: ALL_NAME };

interface ShowProfileRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface UpdateProfileRequest {
  readonly identity: Identity;
  readonly data: Data;
}

export async function showOwnProfile(request: ShowProfileRequest): Promise<UseCaseResult<Data>> {
  const authorization = await authorizeFind({ guard: PROFILE_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const profile = findProfile(request.identity.id);
  if (profile === undefined) return notFound();
  return succeed(projectRecord(profile, authorization.result));
}

export async function updateOwnProfile(request: UpdateProfileRequest): Promise<UseCaseResult<Profile>> {
  const authorization = await authorizeWrite({ guard: PROFILE_ALL, identity: request.identity, method: 'update', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findProfile(request.identity.id);
  if (existing === undefined) return notFound();
  const updated: Profile = {
    ...existing,
    displayName: typeof authorization.result.displayName === 'string' ? authorization.result.displayName : existing.displayName,
    bio: typeof authorization.result.bio === 'string' ? authorization.result.bio : existing.bio,
  };
  replaceProfile(updated);
  return succeed(updated);
}
