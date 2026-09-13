import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, STOCK_ACTION } from './permissions';
import { findStock, insertStock, listStock, replaceStock, type Stock } from './store';

const STOCK_ALL = { action: STOCK_ACTION, name: ALL_NAME };

interface ListStockRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface StockWriteRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface StockUpdateRequest extends StockWriteRequest {
  readonly id: string;
}

export async function listAllStock(request: ListStockRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: STOCK_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listStock().map((entry) => projectRecord(entry, authorization.result)));
}

export async function createStock(request: StockWriteRequest): Promise<UseCaseResult<Stock>> {
  const authorization = await authorizeWrite({ guard: STOCK_ALL, identity: request.identity, method: 'create', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertStock({
    itemId: String(authorization.result.itemId ?? ''),
    warehouse: String(authorization.result.warehouse ?? ''),
    quantity: Number(authorization.result.quantity ?? 0),
    isLocked: false,
  });
  return succeed(created);
}

export async function updateStock(request: StockUpdateRequest): Promise<UseCaseResult<Stock>> {
  const existing = findStock(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({
    guard: STOCK_ALL,
    identity: request.identity,
    method: 'update',
    data: request.data,
    context: { user: { id: request.identity.id }, resource: existing },
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const updated: Stock = {
    ...existing,
    quantity: typeof authorization.result.quantity === 'number' ? authorization.result.quantity : existing.quantity,
    isLocked: typeof authorization.result.isLocked === 'boolean' ? authorization.result.isLocked : existing.isLocked,
  };
  replaceStock(updated);
  return succeed(updated);
}
