import type { Context, Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord, type Guard } from '../../server/authorize';
import { deny, invalidBody, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import type { Collection, FieldValue, StoredRecord } from './store';

export interface Resource {
  readonly guard: Guard;
  readonly collection: Collection;
}

interface ListRequest {
  readonly resource: Resource;
  readonly identity: Identity;
  readonly select?: readonly string[];
  readonly context: Context;
}

interface CreateRequest {
  readonly resource: Resource;
  readonly identity: Identity;
  readonly data: Data;
  readonly context?: Context;
  readonly defaults?: Readonly<Record<string, FieldValue>>;
}

interface UpdateRequest {
  readonly resource: Resource;
  readonly identity: Identity;
  readonly id: string;
  readonly data: Data;
  readonly context: RequestContext;
}

interface RemoveRequest {
  readonly resource: Resource;
  readonly identity: Identity;
  readonly id: string;
  readonly context: RequestContext;
}

const FIELDS_MUST_BE_PRIMITIVE = 'fields must be string, number or boolean values';

function isFieldValue(value: unknown): value is FieldValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function toFields(data: Data): Readonly<Record<string, FieldValue>> | undefined {
  const fields: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isFieldValue(value)) return undefined;
    fields[key] = value;
  }
  return fields;
}

export async function listRecords(request: ListRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: request.resource.guard, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(request.resource.collection.list().map((record) => projectRecord(record, authorization.result)));
}

export async function createRecord(request: CreateRequest): Promise<UseCaseResult<StoredRecord>> {
  const authorization = await authorizeWrite({ guard: request.resource.guard, identity: request.identity, method: 'create', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const fields = toFields(authorization.result);
  if (fields === undefined) return invalidBody(FIELDS_MUST_BE_PRIMITIVE);
  return succeed(request.resource.collection.insert({ ...request.defaults, ...fields }));
}

export async function updateRecord(request: UpdateRequest): Promise<UseCaseResult<StoredRecord>> {
  const authorization = await authorizeWrite({ guard: request.resource.guard, identity: request.identity, method: 'update', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = request.resource.collection.find(request.id);
  if (existing === undefined) return notFound();
  const fields = toFields(authorization.result);
  if (fields === undefined) return invalidBody(FIELDS_MUST_BE_PRIMITIVE);
  const updated: StoredRecord = { ...existing, ...fields, id: existing.id };
  request.resource.collection.replace(updated);
  return succeed(updated);
}

export async function removeRecord(request: RemoveRequest): Promise<UseCaseResult<undefined>> {
  const authorization = await authorizeWrite({ guard: request.resource.guard, identity: request.identity, method: 'remove', data: { id: request.id }, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  if (request.resource.collection.find(request.id) === undefined) return notFound();
  request.resource.collection.delete(request.id);
  return succeed(undefined);
}
