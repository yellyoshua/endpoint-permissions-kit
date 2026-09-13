import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, TAGS_ACTION } from './permissions';
import { deleteTag, findTag, insertTag, listTags, type Tag } from './store';

const TAGS_ALL = { action: TAGS_ACTION, name: ALL_NAME };

interface ListTagsRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface CreateTagRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface RemoveTagRequest {
  readonly identity: Identity;
  readonly id: string;
}

export async function listAllTags(request: ListTagsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: TAGS_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listTags().map((tag) => projectRecord(tag, authorization.result)));
}

export async function createTag(request: CreateTagRequest): Promise<UseCaseResult<Tag>> {
  const authorization = await authorizeWrite({
    guard: TAGS_ALL,
    identity: request.identity,
    method: 'create',
    data: request.data,
    context: { existingLabels: listTags().map((tag) => tag.label) },
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertTag({
    label: String(authorization.result.label ?? ''),
    color: String(authorization.result.color ?? 'gray'),
  });
  return succeed(created);
}

export async function removeTag(request: RemoveTagRequest): Promise<UseCaseResult<undefined>> {
  if (findTag(request.id) === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: TAGS_ALL, identity: request.identity, method: 'remove', data: { id: request.id } });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteTag(request.id);
  return succeed(undefined);
}
