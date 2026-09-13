import pkit from 'endpoint-permissions-kit';
import type { Context, Data, ResolvedPermission } from 'endpoint-permissions-kit';
import { resourceIdOf, sessionUserIdOf } from '../../server/requestContext';
import { findOrder, findStock } from './store';

export const MODULE_PREFIX = 'large';

export const ITEMS_ACTION = 'large.inventory.items';
export const STOCK_ACTION = 'large.inventory.warehouses.stock';
export const ORDERS_ACTION = 'large.sales.orders';
export const LINES_ACTION = 'large.sales.orders.lines';
export const INVOICES_ACTION = 'large.billing.invoices';
export const EMPLOYEES_ACTION = 'large.hr.employees';

export const ALL_NAME = 'all';
export const SUMMARY_NAME = 'summary';
export const UPDATE_ONLY_NAME = 'update-only';
export const ACCOUNTS_NAME = 'accounts';

export const CLOSED_ORDER_MESSAGE = 'Closed orders cannot be updated';
export const NOT_ORDER_OWNER_MESSAGE = 'Only the owner can update this order';
export const LOCKED_STOCK_MESSAGE = 'Derived access cannot update stock of a locked warehouse';
export const GRANT_SOURCES_PREFIX = 'granted by: ';
export const NEGATIVE_ITEM_PRICE_MESSAGE = 'Item price and cost cannot be negative';
export const NEGATIVE_STOCK_MESSAGE = 'Stock quantity cannot be negative';
export const NON_POSITIVE_INVOICE_MESSAGE = 'Invoice amount must be positive';
export const NON_POSITIVE_SALARY_MESSAGE = 'Salary must be positive';

const root = pkit.module(MODULE_PREFIX);
const items = root.module('inventory').module('items');
const stock = root.module('inventory').module('warehouses').module('stock');
const orders = root.module('sales').module('orders');
const lines = root.module('sales').module('orders').module('lines');
const invoices = root.module('billing').module('invoices');
const employees = root.module('hr').module('employees');

const itemsAll = items.name(ALL_NAME);
const stockAll = stock.name(ALL_NAME);
const ordersAll = orders.name(ALL_NAME);
const ordersSummary = orders.name(SUMMARY_NAME);
const ordersUpdateOnly = orders.name(UPDATE_ONLY_NAME);
const linesAll = lines.name(ALL_NAME);
const invoicesAll = invoices.name(ALL_NAME);
const employeesAll = employees.name(ALL_NAME);
const employeesAccounts = employees.name(ACCOUNTS_NAME);

itemsAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['sku', 'name', 'price', 'cost'] },
  update: { enabled: true, properties: ['sku', 'name', 'price', 'cost'] },
  remove: { enabled: true, properties: ['id'] },
});

itemsAll.role('warehouse').registerActions({
  find: { enabled: true, properties: ['id', 'sku', 'name'] },
  update: { enabled: true, properties: ['name'] },
});

itemsAll.role('manager').registerActions({
  find: { enabled: true, properties: ['id', 'sku', 'name', 'price'] },
});

stockAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['itemId', 'warehouse', 'quantity'] },
  update: { enabled: true, properties: ['quantity', 'isLocked'] },
});

stockAll.role('warehouse').registerActions({
  find: { enabled: true, properties: ['id', 'itemId', 'warehouse', 'quantity'] },
  update: { enabled: true, properties: ['quantity'] },
});

ordersAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['customer', 'total'] },
  update: { enabled: true, properties: ['customer', 'total', 'status'] },
  remove: { enabled: true, properties: ['id'] },
});

ordersAll.role('sales').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'total', 'status', 'owner'] },
  create: { enabled: true, properties: ['customer', 'total'] },
  update: { enabled: true, properties: ['customer', 'total'] },
});

ordersAll.role('manager').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'total', 'status', 'owner'] },
  remove: { enabled: true, properties: ['id'] },
});

ordersSummary.role('manager').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'total', 'status'] },
});

ordersSummary.role('accountant').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'total', 'status'] },
});

ordersUpdateOnly.role('sales').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'status'] },
  update: { enabled: true, properties: ['status'] },
});

linesAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['orderId', 'sku', 'quantity', 'price'] },
  update: { enabled: true, properties: ['quantity', 'price'] },
  remove: { enabled: true, properties: ['id'] },
});

linesAll.role('sales').registerActions({
  find: { enabled: true, properties: ['id', 'orderId', 'sku', 'quantity'] },
  create: { enabled: true, properties: ['orderId', 'sku', 'quantity', 'price'] },
  update: { enabled: true, properties: ['quantity'] },
});

invoicesAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

invoicesAll.role('accountant').registerActions({
  find: { enabled: true, properties: ['id', 'orderId', 'amount', 'status', 'issuedAt'] },
  create: { enabled: true, properties: ['orderId', 'amount'] },
  update: { enabled: true, properties: ['status'] },
});

employeesAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['name', 'title', 'salary'] },
  update: { enabled: true, properties: ['name', 'title', 'salary'] },
  remove: { enabled: true, properties: ['id'] },
});

employeesAll.role('hr').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'title', 'salary'] },
  create: { enabled: true, properties: ['name', 'title', 'salary'] },
  update: { enabled: true, properties: ['salary'] },
});

employeesAll.role('manager').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'title'] },
});

employeesAccounts.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  update: { enabled: true, properties: ['permissions'] },
});

itemsAll.grantTo('manager::large.sales.orders::summary').registerActions({
  find: { enabled: true, properties: ['id', 'sku', 'name'] },
});

stockAll.grantTo('warehouse::large.inventory.items::all').registerActions({
  find: { enabled: true, properties: ['id', 'itemId', 'quantity'] },
  update: { enabled: true, properties: ['quantity'] },
});

ordersAll.grantTo('accountant::large.billing.invoices::all').registerActions({
  find: { enabled: true, properties: ['id', 'customer', 'total'] },
});

linesAll.grantTo('sales::large.sales.orders::all').registerActions({
  find: { enabled: true, properties: ['id', 'orderId', 'sku', 'quantity'] },
});

linesAll.grantTo('sales::large.sales.orders::update-only').registerActions({
  find: { enabled: true, properties: ['id', 'sku', 'price'] },
});

invoicesAll.grantTo('sales::large.sales.orders::all').registerActions({
  find: { enabled: true, properties: ['id', 'orderId', 'amount'] },
});

invoicesAll.grantTo('manager::large.sales.orders::summary').registerActions({
  find: { enabled: true, properties: ['id', 'orderId', 'status'] },
});

function targetOrder(context: Context | undefined) {
  const id = resourceIdOf(context);
  return id === undefined ? undefined : findOrder(id);
}

function rejectClosedOrderUpdate(_data: Data | undefined, context: Context | undefined): void {
  if (targetOrder(context)?.status === 'closed') throw new Error(CLOSED_ORDER_MESSAGE);
}

function rejectForeignOrderUpdate(_data: Data | undefined, context: Context | undefined): void {
  const order = targetOrder(context);
  if (order !== undefined && order.owner !== sessionUserIdOf(context)) throw new Error(NOT_ORDER_OWNER_MESSAGE);
}

function rejectDerivedLockedStockUpdate(_data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  if (permission.authorization.direct) return;
  const id = resourceIdOf(context);
  if (id !== undefined && findStock(id)?.isLocked === true) throw new Error(LOCKED_STOCK_MESSAGE);
}

function revealDerivedLineSources(_data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  if (permission.authorization.direct) return;
  if (context?.revealGrantSources !== true) return;
  throw new Error(`${GRANT_SOURCES_PREFIX}${permission.authorization.grantedBy.join(', ')}`);
}

function isNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && value < 0;
}

function rejectNegativeItemPrices(data: Data | undefined): void {
  if (isNegativeNumber(data?.price) || isNegativeNumber(data?.cost)) throw new Error(NEGATIVE_ITEM_PRICE_MESSAGE);
}

function rejectNegativeStockQuantity(data: Data | undefined): void {
  if (isNegativeNumber(data?.quantity)) throw new Error(NEGATIVE_STOCK_MESSAGE);
}

function requirePositiveInvoiceAmount(data: Data | undefined): void {
  if (typeof data?.amount !== 'number' || data.amount <= 0) throw new Error(NON_POSITIVE_INVOICE_MESSAGE);
}

function rejectNonPositiveSalary(data: Data | undefined): void {
  if (data !== undefined && 'salary' in data && (typeof data.salary !== 'number' || data.salary <= 0)) {
    throw new Error(NON_POSITIVE_SALARY_MESSAGE);
  }
}

items.hook('create', rejectNegativeItemPrices);
items.hook('update', rejectNegativeItemPrices);
stock.hook('create', rejectNegativeStockQuantity);
stock.hook('update', rejectNegativeStockQuantity);
employees.hook('create', rejectNonPositiveSalary);
employees.hook('update', rejectNonPositiveSalary);
invoicesAll.role('accountant').hook('create', requirePositiveInvoiceAmount);
orders.hook('update', rejectClosedOrderUpdate);
ordersAll.hook('update', rejectForeignOrderUpdate);
stockAll.role('warehouse').hook('update', rejectDerivedLockedStockUpdate);
linesAll.role('sales').hook('find', revealDerivedLineSources);
