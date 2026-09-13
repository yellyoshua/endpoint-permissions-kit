import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord, type Guard } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { ALL_NAME, ORDERS_ACTION, SUMMARY_NAME, UPDATE_ONLY_NAME } from './permissions';
import { deleteOrder, findOrder, insertOrder, listOrders, replaceOrder, type Order } from './store';

const ORDERS_ALL: Guard = { action: ORDERS_ACTION, name: ALL_NAME };
const ORDERS_SUMMARY: Guard = { action: ORDERS_ACTION, name: SUMMARY_NAME };
const ORDERS_UPDATE_ONLY: Guard = { action: ORDERS_ACTION, name: UPDATE_ONLY_NAME };

interface ListOrdersRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
}

interface OrderWriteRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly data: Data;
}

interface OrderUpdateRequest extends OrderWriteRequest {
  readonly id: string;
}

interface OrderRemoveRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly id: string;
}

async function listOrdersUnder(guard: Guard, request: ListOrdersRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listOrders().map((order) => projectRecord(order, authorization.result)));
}

export function listAllOrders(request: ListOrdersRequest): Promise<UseCaseResult<readonly Data[]>> {
  return listOrdersUnder(ORDERS_ALL, request);
}

export function listOrderSummaries(request: ListOrdersRequest): Promise<UseCaseResult<readonly Data[]>> {
  return listOrdersUnder(ORDERS_SUMMARY, request);
}

export function listOrderStatuses(request: ListOrdersRequest): Promise<UseCaseResult<readonly Data[]>> {
  return listOrdersUnder(ORDERS_UPDATE_ONLY, request);
}

export async function createOrder(request: OrderWriteRequest): Promise<UseCaseResult<Order>> {
  const authorization = await authorizeWrite({ guard: ORDERS_ALL, identity: request.identity, method: 'create', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertOrder({
    customer: String(authorization.result.customer ?? ''),
    total: Number(authorization.result.total ?? 0),
    status: 'open',
    owner: request.identity.id,
  });
  return succeed(created);
}

async function updateOrderUnder(guard: Guard, request: OrderUpdateRequest): Promise<UseCaseResult<Order>> {
  const authorization = await authorizeWrite({
    guard,
    identity: request.identity,
    method: 'update',
    data: request.data,
    context: request.context,
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findOrder(request.id);
  if (existing === undefined) return notFound();
  const updated: Order = {
    ...existing,
    customer: typeof authorization.result.customer === 'string' ? authorization.result.customer : existing.customer,
    total: typeof authorization.result.total === 'number' ? authorization.result.total : existing.total,
    status: typeof authorization.result.status === 'string' ? authorization.result.status : existing.status,
  };
  replaceOrder(updated);
  return succeed(updated);
}

export function updateOrder(request: OrderUpdateRequest): Promise<UseCaseResult<Order>> {
  return updateOrderUnder(ORDERS_ALL, request);
}

export function updateOrderStatus(request: OrderUpdateRequest): Promise<UseCaseResult<Order>> {
  return updateOrderUnder(ORDERS_UPDATE_ONLY, request);
}

export async function removeOrder(request: OrderRemoveRequest): Promise<UseCaseResult<undefined>> {
  const authorization = await authorizeWrite({
    guard: ORDERS_ALL,
    identity: request.identity,
    method: 'remove',
    data: { id: request.id },
    context: request.context,
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  if (findOrder(request.id) === undefined) return notFound();
  deleteOrder(request.id);
  return succeed(undefined);
}
