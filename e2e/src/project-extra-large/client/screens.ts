import type { Screen } from '../../client/screens';
import BlocksScreen from './screens/BlocksScreen';
import EntriesScreen from './screens/EntriesScreen';
import EntriesSummaryScreen from './screens/EntriesSummaryScreen';
import MembersScreen from './screens/MembersScreen';
import NotesReadOnlyScreen from './screens/NotesReadOnlyScreen';
import NotesScreen from './screens/NotesScreen';
import PublishedPagesScreen from './screens/PublishedPagesScreen';
import RepliesScreen from './screens/RepliesScreen';
import ReportsReadOnlyScreen from './screens/ReportsReadOnlyScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';
import UsersScreen from './screens/UsersScreen';

const SCREENS: readonly Screen[] = [
  { path: 'settings', title: 'Tenant settings', permission: { action: 'xl.platform.tenants.settings', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: SettingsScreen },
  { path: 'users', title: 'User permissions', permission: { action: 'xl.platform.tenants.settings', name: 'all', methods: ['update'] }, Component: UsersScreen },
  { path: 'members', title: 'Tenant members', permission: { action: 'xl.platform.tenants.members', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: MembersScreen },
  { path: 'notes', title: 'Contact notes', permission: { action: 'xl.crm.accounts.contacts.notes', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: NotesScreen },
  { path: 'notes-read-only', title: 'Contact notes (read-only)', permission: { action: 'xl.crm.accounts.contacts.notes', name: 'read-only', methods: ['find'] }, Component: NotesReadOnlyScreen },
  { path: 'replies', title: 'Ticket replies', permission: { action: 'xl.support.tickets.replies', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: RepliesScreen },
  { path: 'entries', title: 'Ledger entries', permission: { action: 'xl.finance.ledger.entries', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: EntriesScreen },
  { path: 'entries-summary', title: 'Ledger summary', permission: { action: 'xl.finance.ledger.entries', name: 'summary', methods: ['find'] }, Component: EntriesSummaryScreen },
  { path: 'published', title: 'Published pages', permission: { action: 'xl.content.pages', name: 'published', methods: ['find'] }, Component: PublishedPagesScreen },
  { path: 'blocks', title: 'Page blocks', permission: { action: 'xl.content.pages.blocks', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: BlocksScreen },
  { path: 'reports', title: 'Reports', permission: { action: 'xl.analytics.reports', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: ReportsScreen },
  { path: 'reports-read-only', title: 'Reports (read-only)', permission: { action: 'xl.analytics.reports', name: 'read-only', methods: ['find'] }, Component: ReportsReadOnlyScreen },
];

export default SCREENS;
