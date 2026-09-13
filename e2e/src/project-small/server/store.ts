import type { Identity } from '../../server/identity';

export interface Note {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly author: string;
  readonly pinned: boolean;
}

export interface Tag {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

export interface Profile {
  readonly id: string;
  readonly displayName: string;
  readonly bio: string;
}

export const LIST_LIMIT = 100;

export const ANONYMOUS_IDENTITY: Identity = Object.freeze({
  id: 'anonymous',
  role: 'public',
  permissions: Object.freeze(['public::small.notes::read-only']),
});

const users = new Map<string, Identity>();
const notes = new Map<string, Note>();
const tags = new Map<string, Tag>();
const profiles = new Map<string, Profile>();
const nextIdByPrefix = new Map<string, number>();

function allocateId(prefix: string): string {
  const next = nextIdByPrefix.get(prefix) ?? 1;
  nextIdByPrefix.set(prefix, next + 1);
  return `${prefix}${next}`;
}

export function findUser(id: string): Identity | undefined {
  return users.get(id);
}

export function listNotes(): readonly Note[] {
  return [...notes.values()].slice(0, LIST_LIMIT);
}

export function findNote(id: string): Note | undefined {
  return notes.get(id);
}

export function insertNote(note: Omit<Note, 'id'>): Note {
  const created: Note = { ...note, id: allocateId('n') };
  notes.set(created.id, created);
  return created;
}

export function replaceNote(note: Note): void {
  notes.set(note.id, note);
}

export function deleteNote(id: string): void {
  notes.delete(id);
}

export function listTags(): readonly Tag[] {
  return [...tags.values()].slice(0, LIST_LIMIT);
}

export function findTag(id: string): Tag | undefined {
  return tags.get(id);
}

export function insertTag(tag: Omit<Tag, 'id'>): Tag {
  const created: Tag = { ...tag, id: allocateId('t') };
  tags.set(created.id, created);
  return created;
}

export function deleteTag(id: string): void {
  tags.delete(id);
}

export function findProfile(userId: string): Profile | undefined {
  return profiles.get(userId);
}

export function replaceProfile(profile: Profile): void {
  profiles.set(profile.id, profile);
}

export function reset(): void {
  users.clear();
  notes.clear();
  tags.clear();
  profiles.clear();
  nextIdByPrefix.clear();
}

export function seed(): void {
  reset();
  users.set('mia', { id: 'mia', role: 'member', permissions: ['member::small.notes::all', 'member::small.tags::all', 'member::small.profile::all'] });
  users.set('eli', { id: 'eli', role: 'editor', permissions: ['editor::small.notes::all', 'editor::small.tags::all', 'editor::small.profile::all'] });
  users.set('noah', { id: 'noah', role: 'member', permissions: ['member::small.notes::all'] });
  users.set('zed', { id: 'zed', role: 'member', permissions: [] });
  users.set('rook', { id: 'rook', role: 'member', permissions: ['member::small.notes::all', 'editor::small.tags::all'] });
  insertNote({ title: 'Kickoff', body: 'Agenda for the kickoff', author: 'mia', pinned: true });
  insertNote({ title: 'Retro', body: 'Notes from the retro', author: 'eli', pinned: false });
  insertTag({ label: 'urgent', color: 'red' });
  insertTag({ label: 'idea', color: 'blue' });
  profiles.set('mia', { id: 'mia', displayName: 'Mia', bio: 'Member since 2024' });
  profiles.set('eli', { id: 'eli', displayName: 'Eli', bio: 'Editor' });
  profiles.set('noah', { id: 'noah', displayName: 'Noah', bio: '' });
  profiles.set('zed', { id: 'zed', displayName: 'Zed', bio: '' });
  profiles.set('rook', { id: 'rook', displayName: 'Rook', bio: '' });
}

seed();
