import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, LINES_ACTION } from './permissions';
import { deleteLine, findLine, insertLine, listLines, replaceLine, type Line } from './store';

const LINES_ALL = { action: LINES_ACTION, name: ALL_NAME };

interface ListLinesRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface LineWriteRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface LineUpdateRequest extends LineWriteRequest {
  readonly id: string;
}

interface LineRemoveRequest {
  readonly identity: Identity;
  readonly id: string;
}

export async function listAllLines(request: ListLinesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: LINES_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listLines().map((line) => projectRecord(line, authorization.result)));
}

export async function listLinesRevealingSources(request: ListLinesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: LINES_ALL, identity: request.identity, select: request.select, context: { revealGrantSources: true } });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listLines().map((line) => projectRecord(line, authorization.result)));
}

export async function createLine(request: LineWriteRequest): Promise<UseCaseResult<Line>> {
  const authorization = await authorizeWrite({ guard: LINES_ALL, identity: request.identity, method: 'create', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertLine({
    orderId: String(authorization.result.orderId ?? ''),
    sku: String(authorization.result.sku ?? ''),
    quantity: Number(authorization.result.quantity ?? 0),
    price: Number(authorization.result.price ?? 0),
  });
  return succeed(created);
}

export async function updateLine(request: LineUpdateRequest): Promise<UseCaseResult<Line>> {
  const existing = findLine(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: LINES_ALL, identity: request.identity, method: 'update', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const updated: Line = {
    ...existing,
    quantity: typeof authorization.result.quantity === 'number' ? authorization.result.quantity : existing.quantity,
    price: typeof authorization.result.price === 'number' ? authorization.result.price : existing.price,
  };
  replaceLine(updated);
  return succeed(updated);
}

export async function removeLine(request: LineRemoveRequest): Promise<UseCaseResult<undefined>> {
  if (findLine(request.id) === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: LINES_ALL, identity: request.identity, method: 'remove', data: { id: request.id } });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteLine(request.id);
  return succeed(undefined);
}
