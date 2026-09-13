import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { ALL_NAME, INVOICES_ACTION } from './permissions';
import { deleteInvoice, findInvoice, insertInvoice, listInvoices, replaceInvoice, type Invoice } from './store';

const INVOICES_ALL = { action: INVOICES_ACTION, name: ALL_NAME };
const ISSUED_AT_LENGTH = 10;

interface ListInvoicesRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
}

interface InvoiceWriteRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly data: Data;
}

interface InvoiceUpdateRequest extends InvoiceWriteRequest {
  readonly id: string;
}

interface InvoiceRemoveRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly id: string;
}

export async function listAllInvoices(request: ListInvoicesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: INVOICES_ALL, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listInvoices().map((invoice) => projectRecord(invoice, authorization.result)));
}

export async function createInvoice(request: InvoiceWriteRequest): Promise<UseCaseResult<Invoice>> {
  const authorization = await authorizeWrite({ guard: INVOICES_ALL, identity: request.identity, method: 'create', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertInvoice({
    orderId: String(authorization.result.orderId ?? ''),
    amount: Number(authorization.result.amount ?? 0),
    status: 'draft',
    issuedAt: new Date().toISOString().slice(0, ISSUED_AT_LENGTH),
  });
  return succeed(created);
}

export async function updateInvoice(request: InvoiceUpdateRequest): Promise<UseCaseResult<Invoice>> {
  const authorization = await authorizeWrite({ guard: INVOICES_ALL, identity: request.identity, method: 'update', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findInvoice(request.id);
  if (existing === undefined) return notFound();
  const updated: Invoice = {
    ...existing,
    status: typeof authorization.result.status === 'string' ? authorization.result.status : existing.status,
  };
  replaceInvoice(updated);
  return succeed(updated);
}

export async function removeInvoice(request: InvoiceRemoveRequest): Promise<UseCaseResult<undefined>> {
  if (findInvoice(request.id) === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: INVOICES_ALL, identity: request.identity, method: 'remove', data: { id: request.id }, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteInvoice(request.id);
  return succeed(undefined);
}
