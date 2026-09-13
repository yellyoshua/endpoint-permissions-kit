import type { Identity } from '../../server/identity';

export interface Item {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly cost: number;
}

export interface Stock {
  readonly id: string;
  readonly itemId: string;
  readonly warehouse: string;
  readonly quantity: number;
  readonly isLocked: boolean;
}

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly total: number;
  readonly status: string;
  readonly owner: string;
}

export interface Line {
  readonly id: string;
  readonly orderId: string;
  readonly sku: string;
  readonly quantity: number;
  readonly price: number;
}

export interface Invoice {
  readonly id: string;
  readonly orderId: string;
  readonly amount: number;
  readonly status: string;
  readonly issuedAt: string;
}

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly salary: number;
}

export const LIST_LIMIT = 100;

const users = new Map<string, Identity>();
const items = new Map<string, Item>();
const stock = new Map<string, Stock>();
const orders = new Map<string, Order>();
const lines = new Map<string, Line>();
const invoices = new Map<string, Invoice>();
const employees = new Map<string, Employee>();
const nextIdByPrefix = new Map<string, number>();

function allocateId(prefix: string): string {
  const next = nextIdByPrefix.get(prefix) ?? 1;
  nextIdByPrefix.set(prefix, next + 1);
  return `${prefix}${next}`;
}

export function findUser(id: string): Identity | undefined {
  return users.get(id);
}

export function listUsers(): readonly Identity[] {
  return [...users.values()].slice(0, LIST_LIMIT);
}

export function replaceUserPermissions(id: string, permissions: readonly string[]): Identity | undefined {
  const existing = users.get(id);
  if (existing === undefined) return undefined;
  const updated: Identity = { ...existing, permissions: [...permissions] };
  users.set(id, updated);
  return updated;
}

export function listItems(): readonly Item[] {
  return [...items.values()].slice(0, LIST_LIMIT);
}

export function findItem(id: string): Item | undefined {
  return items.get(id);
}

export function insertItem(item: Omit<Item, 'id'>): Item {
  const created: Item = { ...item, id: allocateId('i') };
  items.set(created.id, created);
  return created;
}

export function replaceItem(item: Item): void {
  items.set(item.id, item);
}

export function deleteItem(id: string): void {
  items.delete(id);
}

export function listStock(): readonly Stock[] {
  return [...stock.values()].slice(0, LIST_LIMIT);
}

export function findStock(id: string): Stock | undefined {
  return stock.get(id);
}

export function insertStock(entry: Omit<Stock, 'id'>): Stock {
  const created: Stock = { ...entry, id: allocateId('s') };
  stock.set(created.id, created);
  return created;
}

export function replaceStock(entry: Stock): void {
  stock.set(entry.id, entry);
}

export function listOrders(): readonly Order[] {
  return [...orders.values()].slice(0, LIST_LIMIT);
}

export function findOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function insertOrder(order: Omit<Order, 'id'>): Order {
  const created: Order = { ...order, id: allocateId('o') };
  orders.set(created.id, created);
  return created;
}

export function replaceOrder(order: Order): void {
  orders.set(order.id, order);
}

export function deleteOrder(id: string): void {
  orders.delete(id);
}

export function listLines(): readonly Line[] {
  return [...lines.values()].slice(0, LIST_LIMIT);
}

export function findLine(id: string): Line | undefined {
  return lines.get(id);
}

export function insertLine(line: Omit<Line, 'id'>): Line {
  const created: Line = { ...line, id: allocateId('l') };
  lines.set(created.id, created);
  return created;
}

export function replaceLine(line: Line): void {
  lines.set(line.id, line);
}

export function deleteLine(id: string): void {
  lines.delete(id);
}

export function listInvoices(): readonly Invoice[] {
  return [...invoices.values()].slice(0, LIST_LIMIT);
}

export function findInvoice(id: string): Invoice | undefined {
  return invoices.get(id);
}

export function insertInvoice(invoice: Omit<Invoice, 'id'>): Invoice {
  const created: Invoice = { ...invoice, id: allocateId('v') };
  invoices.set(created.id, created);
  return created;
}

export function replaceInvoice(invoice: Invoice): void {
  invoices.set(invoice.id, invoice);
}

export function deleteInvoice(id: string): void {
  invoices.delete(id);
}

export function listEmployees(): readonly Employee[] {
  return [...employees.values()].slice(0, LIST_LIMIT);
}

export function findEmployee(id: string): Employee | undefined {
  return employees.get(id);
}

export function insertEmployee(employee: Omit<Employee, 'id'>): Employee {
  const created: Employee = { ...employee, id: allocateId('e') };
  employees.set(created.id, created);
  return created;
}

export function replaceEmployee(employee: Employee): void {
  employees.set(employee.id, employee);
}

export function deleteEmployee(id: string): void {
  employees.delete(id);
}

export function reset(): void {
  users.clear();
  items.clear();
  stock.clear();
  orders.clear();
  lines.clear();
  invoices.clear();
  employees.clear();
  nextIdByPrefix.clear();
}

export function seed(): void {
  reset();
  users.set('ada', {
    id: 'ada',
    role: 'admin',
    permissions: [
      'admin::large.hr.employees::accounts',
      'admin::large.hr.employees::all',
      'admin::large.inventory.items::all',
      'admin::large.inventory.warehouses.stock::all',
      'admin::large.sales.orders::all',
      'admin::large.sales.orders.lines::all',
      'admin::large.billing.invoices::all',
    ],
  });
  users.set('max', { id: 'max', role: 'manager', permissions: ['manager::large.sales.orders::summary', 'manager::large.sales.orders::all', 'manager::large.hr.employees::all'] });
  users.set('meg', { id: 'meg', role: 'manager', permissions: ['manager::large.inventory.items::all', 'manager::large.sales.orders::summary'] });
  users.set('wes', { id: 'wes', role: 'warehouse', permissions: ['warehouse::large.inventory.items::all'] });
  users.set('wil', { id: 'wil', role: 'warehouse', permissions: ['warehouse::large.inventory.items::all', 'warehouse::large.inventory.warehouses.stock::all'] });
  users.set('sam', { id: 'sam', role: 'sales', permissions: ['sales::large.sales.orders::all', 'sales::large.sales.orders::update-only'] });
  users.set('sue', { id: 'sue', role: 'sales', permissions: ['sales::large.sales.orders::all', 'sales::large.sales.orders.lines::all'] });
  users.set('cat', { id: 'cat', role: 'accountant', permissions: ['accountant::large.billing.invoices::all', 'accountant::large.sales.orders::summary'] });
  users.set('hal', { id: 'hal', role: 'hr', permissions: ['hr::large.hr.employees::all'] });
  users.set('nil', { id: 'nil', role: 'manager', permissions: [] });
  users.set('rex', { id: 'rex', role: 'sales', permissions: ['sales::large.sales.orders::all', 'admin::large.sales.orders::all'] });
  insertItem({ sku: 'BOLT-10', name: 'Bolt 10mm', price: 0.5, cost: 0.2 });
  insertItem({ sku: 'NUT-10', name: 'Nut 10mm', price: 0.3, cost: 0.1 });
  insertStock({ itemId: 'i1', warehouse: 'north', quantity: 120, isLocked: false });
  insertStock({ itemId: 'i2', warehouse: 'south', quantity: 40, isLocked: true });
  insertOrder({ customer: 'ACME', total: 250, status: 'open', owner: 'sam' });
  insertOrder({ customer: 'Globex', total: 900, status: 'closed', owner: 'sue' });
  insertOrder({ customer: 'Initech', total: 75, status: 'open', owner: 'ada' });
  insertLine({ orderId: 'o1', sku: 'BOLT-10', quantity: 100, price: 0.5 });
  insertLine({ orderId: 'o1', sku: 'NUT-10', quantity: 100, price: 0.3 });
  insertLine({ orderId: 'o2', sku: 'BOLT-10', quantity: 1800, price: 0.5 });
  insertInvoice({ orderId: 'o2', amount: 900, status: 'paid', issuedAt: '2026-01-15' });
  insertInvoice({ orderId: 'o1', amount: 250, status: 'draft', issuedAt: '2026-02-01' });
  insertEmployee({ name: 'Ada Lovelace', title: 'CTO', salary: 9000 });
  insertEmployee({ name: 'Hal Jordan', title: 'HR lead', salary: 5000 });
  insertEmployee({ name: 'Sam Spade', title: 'Sales rep', salary: 4000 });
}

seed();
