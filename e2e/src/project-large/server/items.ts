import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, ITEMS_ACTION } from './permissions';
import { deleteItem, findItem, insertItem, listItems, replaceItem, type Item } from './store';

const ITEMS_ALL = { action: ITEMS_ACTION, name: ALL_NAME };

interface ListItemsRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface ItemWriteRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface ItemUpdateRequest extends ItemWriteRequest {
  readonly id: string;
}

interface ItemRemoveRequest {
  readonly identity: Identity;
  readonly id: string;
}

export async function listAllItems(request: ListItemsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: ITEMS_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listItems().map((item) => projectRecord(item, authorization.result)));
}

export async function createItem(request: ItemWriteRequest): Promise<UseCaseResult<Item>> {
  const authorization = await authorizeWrite({ guard: ITEMS_ALL, identity: request.identity, method: 'create', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertItem({
    sku: String(authorization.result.sku ?? ''),
    name: String(authorization.result.name ?? ''),
    price: Number(authorization.result.price ?? 0),
    cost: Number(authorization.result.cost ?? 0),
  });
  return succeed(created);
}

export async function updateItem(request: ItemUpdateRequest): Promise<UseCaseResult<Item>> {
  const existing = findItem(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: ITEMS_ALL, identity: request.identity, method: 'update', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const updated: Item = {
    ...existing,
    sku: typeof authorization.result.sku === 'string' ? authorization.result.sku : existing.sku,
    name: typeof authorization.result.name === 'string' ? authorization.result.name : existing.name,
    price: typeof authorization.result.price === 'number' ? authorization.result.price : existing.price,
    cost: typeof authorization.result.cost === 'number' ? authorization.result.cost : existing.cost,
  };
  replaceItem(updated);
  return succeed(updated);
}

export async function removeItem(request: ItemRemoveRequest): Promise<UseCaseResult<undefined>> {
  if (findItem(request.id) === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: ITEMS_ALL, identity: request.identity, method: 'remove', data: { id: request.id } });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteItem(request.id);
  return succeed(undefined);
}
