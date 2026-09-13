import pkit from 'endpoint-permissions-kit';
import type { Context, Data, ResolvedPermission } from 'endpoint-permissions-kit';
import { resourceIdOf, sessionUserIdOf } from '../../server/requestContext';
import { contactNotes, entries as ledgerEntries, members as tenantMembers, reports as analyticsReports, tickets, type StoredRecord } from './store';

export const MODULE_PREFIX = 'xl';

export const SETTINGS_ACTION = 'xl.platform.tenants.settings';
export const MEMBERS_ACTION = 'xl.platform.tenants.members';
export const NOTES_ACTION = 'xl.crm.accounts.contacts.notes';
export const REPLIES_ACTION = 'xl.support.tickets.replies';
export const ENTRIES_ACTION = 'xl.finance.ledger.entries';
export const PAGES_ACTION = 'xl.content.pages';
export const BLOCKS_ACTION = 'xl.content.pages.blocks';
export const REPORTS_ACTION = 'xl.analytics.reports';

export const ALL_NAME = 'all';
export const READ_ONLY_NAME = 'read-only';
export const SUMMARY_NAME = 'summary';
export const PUBLISHED_NAME = 'published';

export const MISSING_TENANT_CONTEXT_MESSAGE = 'Member invitations require a tenant context';
export const CLOSED_TICKET_MESSAGE = 'Closed tickets do not accept replies';
export const RECONCILED_ENTRY_MESSAGE = 'Reconciled entries cannot be removed';
export const LARGE_ENTRY_MESSAGE = 'Entries above the removal threshold cannot be removed';
export const NOTE_AUTHOR_MESSAGE = 'Only the author can edit a contact note';
export const PINNED_REPORT_MESSAGE = 'Pinned reports cannot be removed';
export const OWNER_MEMBER_MESSAGE = 'Owner members cannot be removed by an admin';
export const NON_POSITIVE_AMOUNT_MESSAGE = 'Entry amount must be positive';
export const GRANTED_INTERNAL_REPLIES_MESSAGE = 'Granted reply access excludes the internal scope';
export const BLANK_TENANT_NAME_MESSAGE = 'Tenant name cannot be blank';
export const BLOCK_KIND_REQUIRED_MESSAGE = 'Block kind is required';
export const NOTE_BODY_REQUIRED_MESSAGE = 'Note body is required';

export const ENTRY_REMOVAL_THRESHOLD = 10000;

const root = pkit.module(MODULE_PREFIX);
const settings = root.module('platform').module('tenants').module('settings');
const members = root.module('platform').module('tenants').module('members');
const notes = root.module('crm').module('accounts').module('contacts').module('notes');
const replies = root.module('support').module('tickets').module('replies');
const entries = root.module('finance').module('ledger').module('entries');
const pages = root.module('content').module('pages');
const blocks = root.module('content').module('pages').module('blocks');
const reports = root.module('analytics').module('reports');

const settingsAll = settings.name(ALL_NAME);
const membersAll = members.name(ALL_NAME);
const notesAll = notes.name(ALL_NAME);
const notesReadOnly = notes.name(READ_ONLY_NAME);
const repliesAll = replies.name(ALL_NAME);
const entriesAll = entries.name(ALL_NAME);
const entriesSummary = entries.name(SUMMARY_NAME);
const pagesPublished = pages.name(PUBLISHED_NAME);
const blocksAll = blocks.name(ALL_NAME);
const reportsAll = reports.name(ALL_NAME);
const reportsReadOnly = reports.name(READ_ONLY_NAME);

settingsAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: '*' },
  update: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: '*' },
});

settingsAll.role('admin').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'plan', 'locale'] },
  update: { enabled: true, properties: ['name', 'locale'] },
});

settingsAll.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'plan'] },
  update: { enabled: false, properties: [] },
  remove: { enabled: false, properties: [] },
});

membersAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: '*' },
  update: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: '*' },
});

membersAll.role('admin').registerActions({
  find: { enabled: true, properties: ['id', 'email', 'role', 'tenantId'] },
  create: { enabled: true, properties: ['email', 'role', 'tenantId'] },
  remove: { enabled: true, properties: ['id'] },
});

membersAll.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'email', 'role'] },
  create: { enabled: false, properties: [] },
});

notesAll.role('agent').registerActions({
  find: { enabled: true, properties: ['id', 'contactId', 'body', 'author'] },
  create: { enabled: true, properties: ['contactId', 'body'] },
  update: { enabled: true, properties: ['body'] },
});

notesAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

notesReadOnly.role('analyst').registerActions({
  find: { enabled: true, properties: ['id', 'contactId', 'author'] },
});

notesReadOnly.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'contactId'] },
});

repliesAll.role('agent').registerActions({
  find: { enabled: true, properties: ['id', 'ticketId', 'body', 'author', 'internal'] },
  create: { enabled: true, properties: ['ticketId', 'body', 'internal'] },
  update: { enabled: true, properties: ['body'] },
  remove: { enabled: true, properties: ['id'] },
});

repliesAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

repliesAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: '*' },
});

repliesAll.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'ticketId', 'author'] },
  update: { enabled: false, properties: [] },
  remove: { enabled: false, properties: [] },
});

entriesAll.role('finance').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['amount', 'memo', 'account'] },
  update: { enabled: true, properties: ['memo'] },
  remove: { enabled: false, properties: [] },
});

entriesAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

entriesAll.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'amount', 'account'] },
  create: { enabled: false, properties: [] },
  update: { enabled: false, properties: [] },
  remove: { enabled: false, properties: [] },
});

entriesSummary.role('analyst').registerActions({
  find: { enabled: true, properties: ['id', 'amount', 'account'] },
});

entriesSummary.role('finance').registerActions({
  find: { enabled: true, properties: ['id', 'amount', 'account', 'memo'] },
});

pagesPublished.role('public').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'slug'] },
});

pagesPublished.role('author').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'slug', 'body'] },
});

blocksAll.role('author').registerActions({
  find: { enabled: true, properties: ['id', 'pageId', 'kind', 'text'] },
  create: { enabled: true, properties: ['pageId', 'kind', 'text'] },
  update: { enabled: true, properties: ['kind', 'text'] },
  remove: { enabled: true, properties: ['id'] },
});

blocksAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

blocksAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: '*' },
  update: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: '*' },
});

reportsAll.role('analyst').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['title', 'query'] },
  update: { enabled: true, properties: ['title', 'query'] },
  remove: { enabled: true, properties: ['id'] },
});

reportsAll.role('admin').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'owner'] },
});

reportsAll.role('owner').registerActions({
  find: { enabled: true, properties: '*' },
  update: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: '*' },
});

reportsReadOnly.role('auditor').registerActions({
  find: { enabled: true, properties: ['id', 'title'] },
});

reportsReadOnly.role('finance').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'owner'] },
});

reportsReadOnly.role('agent').registerActions({
  find: { enabled: true, properties: ['id', 'title'] },
});

membersAll.grantTo('owner::xl.platform.tenants.settings::all').registerActions({
  find: { enabled: true, properties: ['id', 'email', 'role'] },
});

entriesSummary.grantTo('owner::xl.platform.tenants.settings::all').registerActions({
  find: { enabled: true, properties: ['id', 'amount', 'account'] },
});

blocksAll.grantTo('admin::xl.platform.tenants.settings::all').registerActions({
  find: { enabled: true, properties: ['id', 'pageId', 'kind'] },
  remove: { enabled: true, properties: ['id'] },
});

notesAll.grantTo('admin::xl.platform.tenants.members::all').registerActions({
  find: { enabled: true, properties: ['id', 'contactId', 'author'] },
});

repliesAll.grantTo('admin::xl.platform.tenants.members::all').registerActions({
  find: { enabled: true, properties: ['id', 'ticketId', 'author'] },
});

repliesAll.grantTo('agent::xl.crm.accounts.contacts.notes::all').registerActions({
  find: { enabled: true, properties: ['id', 'ticketId', 'body'] },
});

repliesAll.grantTo('agent::xl.analytics.reports::read-only').registerActions({
  find: { enabled: true, properties: ['id', 'author'] },
});

notesReadOnly.grantTo('agent::xl.support.tickets.replies::all').registerActions({
  find: { enabled: true, properties: ['id', 'contactId'] },
});

reportsAll.grantTo('finance::xl.finance.ledger.entries::all').registerActions({
  find: { enabled: true, properties: ['id', 'title'] },
});

entriesAll.grantTo('analyst::xl.analytics.reports::all').registerActions({
  find: { enabled: true, properties: ['id', 'amount', 'account'] },
});

pagesPublished.grantTo('author::xl.content.pages.blocks::all').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'slug'] },
});

settingsAll.grantTo('auditor::xl.finance.ledger.entries::all').registerActions({
  find: { enabled: true, properties: ['id', 'name'] },
});

function requireTenantContext(_data: Data | undefined, context: Context | undefined): void {
  if (context === undefined) throw new Error(MISSING_TENANT_CONTEXT_MESSAGE);
}

function targetRecord(context: Context | undefined, find: (id: string) => StoredRecord | undefined): StoredRecord | undefined {
  const id = resourceIdOf(context);
  return id === undefined ? undefined : find(id);
}

async function rejectClosedTicketReply(data: Data | undefined): Promise<void> {
  const ticket = tickets.find(String(data?.ticketId ?? ''));
  await Promise.resolve();
  if (ticket?.status === 'closed') throw new Error(CLOSED_TICKET_MESSAGE);
}

function rejectReconciledEntryRemoval(_data: Data | undefined, context: Context | undefined): void {
  if (targetRecord(context, ledgerEntries.find)?.reconciled === true) throw new Error(RECONCILED_ENTRY_MESSAGE);
}

function rejectLargeEntryRemoval(_data: Data | undefined, context: Context | undefined): void {
  const amount = targetRecord(context, ledgerEntries.find)?.amount;
  if (typeof amount === 'number' && amount > ENTRY_REMOVAL_THRESHOLD) throw new Error(LARGE_ENTRY_MESSAGE);
}

function requireNoteAuthor(_data: Data | undefined, context: Context | undefined): void {
  const note = targetRecord(context, contactNotes.find);
  if (note !== undefined && note.author !== sessionUserIdOf(context)) throw new Error(NOTE_AUTHOR_MESSAGE);
}

async function rejectPinnedReportRemoval(_data: Data | undefined, context: Context | undefined): Promise<void> {
  const report = targetRecord(context, analyticsReports.find);
  await Promise.resolve();
  if (report?.pinned === true) throw new Error(PINNED_REPORT_MESSAGE);
}

function rejectOwnerMemberRemoval(_data: Data | undefined, context: Context | undefined): void {
  if (targetRecord(context, tenantMembers.find)?.role === 'owner') throw new Error(OWNER_MEMBER_MESSAGE);
}

async function requirePositiveAmount(data: Data | undefined): Promise<void> {
  await Promise.resolve();
  if (typeof data?.amount !== 'number' || data.amount <= 0) throw new Error(NON_POSITIVE_AMOUNT_MESSAGE);
}

function rejectGrantedInternalScope(_data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  if (permission.authorization.direct) return;
  if (context?.isInternalScope === true) throw new Error(GRANTED_INTERNAL_REPLIES_MESSAGE);
}

function rejectBlankTenantName(data: Data | undefined): void {
  if (data !== undefined && 'name' in data && (typeof data.name !== 'string' || data.name.trim() === '')) {
    throw new Error(BLANK_TENANT_NAME_MESSAGE);
  }
}

function requireBlockKind(data: Data | undefined): void {
  if (typeof data?.kind !== 'string' || data.kind.trim() === '') throw new Error(BLOCK_KIND_REQUIRED_MESSAGE);
}

function requireNoteBody(data: Data | undefined): void {
  if (typeof data?.body !== 'string' || data.body.trim() === '') throw new Error(NOTE_BODY_REQUIRED_MESSAGE);
}

settings.hook('update', rejectBlankTenantName);
blocks.hook('create', requireBlockKind);
notesAll.hook('create', requireNoteBody);
members.hook('create', requireTenantContext);
replies.hook('create', rejectClosedTicketReply);
entries.hook('remove', rejectReconciledEntryRemoval);

entriesAll.hook('remove', rejectLargeEntryRemoval);
notesAll.hook('update', requireNoteAuthor);
reportsAll.hook('remove', rejectPinnedReportRemoval);

membersAll.role('admin').hook('remove', rejectOwnerMemberRemoval);
entriesAll.role('finance').hook('create', requirePositiveAmount);
repliesAll.role('admin').hook('find', rejectGrantedInternalScope);
