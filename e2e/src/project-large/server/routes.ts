import { Router, type Request, type Response } from 'express';
import type { Data } from 'endpoint-permissions-kit';
import { asData, parseSelect } from '../../server/body';
import { createCatalogHandler } from '../../server/catalogRoute';
import { invalidBody, type UseCaseResult } from '../../server/errors';
import { createIdentityMiddleware } from '../../server/identity';
import meHandler from '../../server/meRoute';
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK, respond } from '../../server/respond';
import { asPermissionList, assignPermissionsToUser, listAccounts } from './accounts';
import { createEmployee, listAllEmployees, removeEmployee, updateEmployee } from './employees';
import { createInvoice, listAllInvoices, removeInvoice, updateInvoice } from './invoices';
import { createItem, listAllItems, removeItem, updateItem } from './items';
import { createLine, listAllLines, listLinesRevealingSources, removeLine, updateLine } from './lines';
import { createOrder, listAllOrders, listOrderStatuses, listOrderSummaries, removeOrder, updateOrder, updateOrderStatus } from './orders';
import { ACCOUNTS_NAME, EMPLOYEES_ACTION, MODULE_PREFIX } from './permissions';
import { createStock, listAllStock, updateStock } from './stock';
import { findUser } from './store';

const BODY_MUST_BE_OBJECT = 'body must be a JSON object';
const PERMISSIONS_MUST_BE_STRINGS = 'permissions must be an array of strings';

type WriteUseCase<Value> = (data: Data) => Promise<UseCaseResult<Value>>;

async function respondWrite<Value>(req: Request, res: Response, status: number, useCase: WriteUseCase<Value>): Promise<void> {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), status);
    return;
  }
  respond(res, await useCase(data), status);
}

const router = Router();

router.use(createIdentityMiddleware({ findUser }));

router.get('/me', meHandler);
router.get('/catalog', createCatalogHandler({ modulePrefix: MODULE_PREFIX, guard: { action: EMPLOYEES_ACTION, name: ACCOUNTS_NAME } }));

router.get('/hr/employees/accounts', async (req, res) => {
  respond(res, await listAccounts({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.put('/users/:id/permissions', async (req, res) => {
  const data = asData(req.body);
  const permissions = asPermissionList(data?.permissions);
  if (data === undefined || permissions === undefined) {
    respond(res, invalidBody(PERMISSIONS_MUST_BE_STRINGS), HTTP_OK);
    return;
  }
  respond(res, await assignPermissionsToUser({ identity: res.locals.identity, userId: req.params.id, data, permissions }), HTTP_OK);
});

router.get('/inventory/items', async (req, res) => {
  respond(res, await listAllItems({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/inventory/items', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createItem({ identity: res.locals.identity, data })));

router.patch('/inventory/items/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateItem({ identity: res.locals.identity, id: req.params.id, data })));

router.delete('/inventory/items/:id', async (req, res) => {
  respond(res, await removeItem({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/inventory/warehouses/stock', async (req, res) => {
  respond(res, await listAllStock({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/inventory/warehouses/stock', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createStock({ identity: res.locals.identity, data })));

router.patch('/inventory/warehouses/stock/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateStock({ identity: res.locals.identity, id: req.params.id, data })));

router.get('/sales/orders', async (req, res) => {
  respond(res, await listAllOrders({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.get('/sales/orders/summary', async (req, res) => {
  respond(res, await listOrderSummaries({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.get('/sales/orders/status', async (req, res) => {
  respond(res, await listOrderStatuses({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/sales/orders', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createOrder({ identity: res.locals.identity, data })));

router.patch('/sales/orders/status/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateOrderStatus({ identity: res.locals.identity, id: req.params.id, data })));

router.patch('/sales/orders/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateOrder({ identity: res.locals.identity, id: req.params.id, data })));

router.delete('/sales/orders/:id', async (req, res) => {
  respond(res, await removeOrder({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/sales/orders/lines', async (req, res) => {
  respond(res, await listAllLines({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.get('/sales/orders/lines/sources', async (req, res) => {
  respond(res, await listLinesRevealingSources({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/sales/orders/lines', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createLine({ identity: res.locals.identity, data })));

router.patch('/sales/orders/lines/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateLine({ identity: res.locals.identity, id: req.params.id, data })));

router.delete('/sales/orders/lines/:id', async (req, res) => {
  respond(res, await removeLine({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/billing/invoices', async (req, res) => {
  respond(res, await listAllInvoices({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/billing/invoices', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createInvoice({ identity: res.locals.identity, data })));

router.patch('/billing/invoices/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateInvoice({ identity: res.locals.identity, id: req.params.id, data })));

router.delete('/billing/invoices/:id', async (req, res) => {
  respond(res, await removeInvoice({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/hr/employees', async (req, res) => {
  respond(res, await listAllEmployees({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/hr/employees', (req, res) => respondWrite(req, res, HTTP_CREATED, (data) => createEmployee({ identity: res.locals.identity, data })));

router.patch('/hr/employees/:id', (req, res) => respondWrite(req, res, HTTP_OK, (data) => updateEmployee({ identity: res.locals.identity, id: req.params.id, data })));

router.delete('/hr/employees/:id', async (req, res) => {
  respond(res, await removeEmployee({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

export default router;
