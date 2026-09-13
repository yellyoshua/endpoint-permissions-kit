import type { Screen } from '../../client/screens';
import NotesScreen from './screens/NotesScreen';
import ProfileScreen from './screens/ProfileScreen';
import PublishedNotesScreen from './screens/PublishedNotesScreen';
import TagsScreen from './screens/TagsScreen';

const SCREENS: readonly Screen[] = [
  { path: 'published', title: 'Published notes', permission: { action: 'small.notes', name: 'read-only', methods: ['find'] }, Component: PublishedNotesScreen },
  { path: 'notes', title: 'Notes', permission: { action: 'small.notes', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: NotesScreen },
  { path: 'tags', title: 'Tags', permission: { action: 'small.tags', name: 'all', methods: ['find', 'create', 'remove'] }, Component: TagsScreen },
  { path: 'profile', title: 'Profile', permission: { action: 'small.profile', name: 'all', methods: ['find', 'update'] }, Component: ProfileScreen },
];

export default SCREENS;
