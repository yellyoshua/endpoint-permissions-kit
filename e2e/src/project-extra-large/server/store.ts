import type { Identity } from '../../server/identity';

export type FieldValue = string | number | boolean;

export type StoredRecord = { readonly id: string } & Readonly<Record<string, FieldValue>>;

export interface Collection {
  list(): readonly StoredRecord[];
  find(id: string): StoredRecord | undefined;
  insert(fields: Readonly<Record<string, FieldValue>>): StoredRecord;
  replace(record: StoredRecord): void;
  delete(id: string): void;
  clear(): void;
}

export const LIST_LIMIT = 100;

export const ANONYMOUS_IDENTITY: Identity = Object.freeze({
  id: 'anonymous',
  role: 'public',
  permissions: Object.freeze(['public::xl.content.pages::published']),
});

function createCollection(idPrefix: string): Collection {
  const records = new Map<string, StoredRecord>();
  let nextId = 1;
  return {
    list: () => [...records.values()].slice(0, LIST_LIMIT),
    find: (id) => records.get(id),
    insert: (fields) => {
      const created: StoredRecord = { ...fields, id: `${idPrefix}${nextId}` };
      nextId += 1;
      records.set(created.id, created);
      return created;
    },
    replace: (record) => {
      records.set(record.id, record);
    },
    delete: (id) => {
      records.delete(id);
    },
    clear: () => {
      records.clear();
      nextId = 1;
    },
  };
}

const users = new Map<string, Identity>();

export const tenants = createCollection('tn');
export const members = createCollection('mb');
export const contactNotes = createCollection('cn');
export const tickets = createCollection('tk');
export const replies = createCollection('rp');
export const entries = createCollection('le');
export const pages = createCollection('pg');
export const blocks = createCollection('bk');
export const reports = createCollection('rt');

const ALL_COLLECTIONS: readonly Collection[] = [tenants, members, contactNotes, tickets, replies, entries, pages, blocks, reports];

export function findUser(id: string): Identity | undefined {
  return users.get(id);
}

export function replaceUserPermissions(id: string, permissions: readonly string[]): Identity | undefined {
  const existing = users.get(id);
  if (existing === undefined) return undefined;
  const updated: Identity = { ...existing, permissions: [...permissions] };
  users.set(id, updated);
  return updated;
}

export function reset(): void {
  users.clear();
  for (const collection of ALL_COLLECTIONS) collection.clear();
}

export function seed(): void {
  reset();
  users.set('olivia', {
    id: 'olivia',
    role: 'owner',
    permissions: [
      'owner::xl.platform.tenants.settings::all',
      'owner::xl.platform.tenants.members::all',
      'owner::xl.support.tickets.replies::all',
      'owner::xl.finance.ledger.entries::all',
      'owner::xl.content.pages.blocks::all',
      'owner::xl.analytics.reports::all',
    ],
  });
  users.set('oscar', { id: 'oscar', role: 'owner', permissions: ['owner::xl.platform.tenants.settings::all'] });
  users.set('adam', {
    id: 'adam',
    role: 'admin',
    permissions: [
      'admin::xl.platform.tenants.settings::all',
      'admin::xl.platform.tenants.members::all',
      'admin::xl.crm.accounts.contacts.notes::all',
      'admin::xl.support.tickets.replies::all',
      'admin::xl.content.pages.blocks::all',
      'admin::xl.analytics.reports::all',
    ],
  });
  users.set('ana', { id: 'ana', role: 'admin', permissions: ['admin::xl.platform.tenants.members::all'] });
  users.set('gus', {
    id: 'gus',
    role: 'agent',
    permissions: ['agent::xl.crm.accounts.contacts.notes::all', 'agent::xl.support.tickets.replies::all', 'agent::xl.analytics.reports::read-only'],
  });
  users.set('gia', { id: 'gia', role: 'agent', permissions: ['agent::xl.crm.accounts.contacts.notes::all', 'agent::xl.analytics.reports::read-only'] });
  users.set('dupe', {
    id: 'dupe',
    role: 'agent',
    permissions: [
      'agent::xl.crm.accounts.contacts.notes::all',
      'agent::xl.crm.accounts.contacts.notes::all',
      'agent::xl.analytics.reports::read-only',
      'agent::xl.analytics.reports::read-only',
    ],
  });
  users.set('nina', {
    id: 'nina',
    role: 'analyst',
    permissions: ['analyst::xl.analytics.reports::all', 'analyst::xl.crm.accounts.contacts.notes::read-only', 'analyst::xl.finance.ledger.entries::summary'],
  });
  users.set('fin', {
    id: 'fin',
    role: 'finance',
    permissions: ['finance::xl.finance.ledger.entries::all', 'finance::xl.finance.ledger.entries::summary', 'finance::xl.analytics.reports::read-only'],
  });
  users.set('aria', { id: 'aria', role: 'author', permissions: ['author::xl.content.pages.blocks::all'] });
  users.set('audrey', {
    id: 'audrey',
    role: 'auditor',
    permissions: [
      'auditor::xl.platform.tenants.settings::all',
      'auditor::xl.platform.tenants.members::all',
      'auditor::xl.crm.accounts.contacts.notes::read-only',
      'auditor::xl.support.tickets.replies::all',
      'auditor::xl.finance.ledger.entries::all',
      'auditor::xl.analytics.reports::read-only',
    ],
  });
  users.set('zero', { id: 'zero', role: 'author', permissions: [] });
  users.set('rook', { id: 'rook', role: 'agent', permissions: ['agent::xl.crm.accounts.contacts.notes::all', 'admin::xl.platform.tenants.members::all'] });

  tenants.insert({ name: 'Acme', plan: 'enterprise', locale: 'en', apiKey: 'acme-secret' });
  tenants.insert({ name: 'Globex', plan: 'starter', locale: 'es', apiKey: 'globex-secret' });
  members.insert({ email: 'olivia@acme.test', role: 'owner', tenantId: 'tn1', invitedBy: 'system' });
  members.insert({ email: 'adam@acme.test', role: 'admin', tenantId: 'tn1', invitedBy: 'olivia' });
  contactNotes.insert({ contactId: 'c1', body: 'Called about renewal', author: 'gus', pinned: false });
  contactNotes.insert({ contactId: 'c2', body: 'Requested a demo', author: 'gia', pinned: true });
  tickets.insert({ subject: 'Login fails', status: 'open' });
  tickets.insert({ subject: 'Old invoice', status: 'closed' });
  replies.insert({ ticketId: 'tk1', body: 'Looking into it', author: 'gus', internal: false });
  replies.insert({ ticketId: 'tk1', body: 'Escalated to tier 2', author: 'gus', internal: true });
  entries.insert({ amount: 250, memo: 'Office supplies', account: 'expenses', reconciled: false });
  entries.insert({ amount: 12000, memo: 'Annual license', account: 'revenue', reconciled: true });
  entries.insert({ amount: 90, memo: 'Coffee', account: 'expenses', reconciled: true });
  pages.insert({ title: 'Home', slug: 'home', body: 'Welcome', status: 'published' });
  pages.insert({ title: 'Pricing', slug: 'pricing', body: 'Plans', status: 'published' });
  blocks.insert({ pageId: 'pg1', kind: 'hero', text: 'Welcome to Acme', draft: false });
  blocks.insert({ pageId: 'pg2', kind: 'table', text: 'Plan comparison', draft: true });
  reports.insert({ title: 'Churn', query: 'select churn', owner: 'nina', pinned: true });
  reports.insert({ title: 'Revenue', query: 'select revenue', owner: 'nina', pinned: false });
}

seed();
