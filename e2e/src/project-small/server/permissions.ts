import pkit from 'endpoint-permissions-kit';
import type { Context, Data } from 'endpoint-permissions-kit';
import { resourceIdOf, sessionUserIdOf } from '../../server/requestContext';
import { findNote, listTags } from './store';

export const MODULE_PREFIX = 'small';

export const NOTES_ACTION = 'small.notes';
export const TAGS_ACTION = 'small.tags';
export const PROFILE_ACTION = 'small.profile';

export const ALL_NAME = 'all';
export const READ_ONLY_NAME = 'read-only';

export const PINNED_NOTE_MESSAGE = 'Pinned notes cannot be removed';
export const DUPLICATE_TAG_MESSAGE = 'Tag label already exists';
export const NOTE_TITLE_REQUIRED_MESSAGE = 'Note title is required';
export const BLANK_DISPLAY_NAME_MESSAGE = 'Display name cannot be blank';
export const FOREIGN_NOTE_UPDATE_MESSAGE = 'Only own notes can be updated';
export const FOREIGN_NOTE_AUTHOR_MESSAGE = 'Only own notes can be created';

const root = pkit.module(MODULE_PREFIX);
const notes = root.module('notes');
const tags = root.module('tags');
const profile = root.module('profile');

notes.name(READ_ONLY_NAME).role('public').registerActions({
  find: { enabled: true, properties: ['id', 'title'] },
});

notes.name(ALL_NAME).role('member').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'body', 'author'] },
  create: { enabled: true, properties: ['title', 'body', 'author'] },
  update: { enabled: true, properties: ['title', 'body', 'author'] },
  remove: { enabled: false, properties: [] },
});

notes.name(ALL_NAME).role('editor').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['title', 'body', 'pinned'] },
  update: { enabled: true, properties: ['title', 'body', 'pinned'] },
  remove: { enabled: true, properties: ['id'] },
});

tags.name(ALL_NAME).role('member').registerActions({
  find: { enabled: true, properties: ['id', 'label'] },
});

tags.name(ALL_NAME).role('editor').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['label', 'color'] },
  remove: { enabled: true, properties: ['id'] },
});

profile.name(ALL_NAME).role('member').registerActions({
  find: { enabled: true, properties: ['id', 'displayName'] },
  update: { enabled: true, properties: ['displayName'] },
});

profile.name(ALL_NAME).role('editor').registerActions({
  find: { enabled: true, properties: '*' },
  update: { enabled: true, properties: ['displayName', 'bio'] },
});

function targetNote(context: Context | undefined) {
  const id = resourceIdOf(context);
  return id === undefined ? undefined : findNote(id);
}

function rejectPinnedNoteRemoval(_data: Data | undefined, context: Context | undefined): void {
  if (targetNote(context)?.pinned === true) throw new Error(PINNED_NOTE_MESSAGE);
}

async function rejectDuplicateTagLabel(data: Data | undefined): Promise<void> {
  const label = data?.label;
  await Promise.resolve();
  if (typeof label === 'string' && listTags().some((tag) => tag.label === label)) throw new Error(DUPLICATE_TAG_MESSAGE);
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function requireNoteTitle(data: Data | undefined): void {
  if (isBlank(data?.title)) throw new Error(NOTE_TITLE_REQUIRED_MESSAGE);
}

function rejectBlankNoteTitle(data: Data | undefined): void {
  if (data !== undefined && 'title' in data && isBlank(data.title)) throw new Error(NOTE_TITLE_REQUIRED_MESSAGE);
}

function rejectBlankDisplayName(data: Data | undefined): void {
  if (data !== undefined && 'displayName' in data && isBlank(data.displayName)) throw new Error(BLANK_DISPLAY_NAME_MESSAGE);
}

function requireOwnNoteUpdate(_data: Data | undefined, context: Context | undefined): void {
  const note = targetNote(context);
  if (note !== undefined && note.author !== sessionUserIdOf(context)) throw new Error(FOREIGN_NOTE_UPDATE_MESSAGE);
}

function rejectForeignNoteAuthor(data: Data | undefined, context: Context | undefined): void {
  if (data?.author !== undefined && data.author !== sessionUserIdOf(context)) throw new Error(FOREIGN_NOTE_AUTHOR_MESSAGE);
}

notes.name(ALL_NAME).role('member').hook('update', requireOwnNoteUpdate);
notes.name(ALL_NAME).hook('create', rejectForeignNoteAuthor);
notes.hook('create', requireNoteTitle);
notes.hook('update', rejectBlankNoteTitle);
notes.hook('remove', rejectPinnedNoteRemoval);
tags.hook('create', rejectDuplicateTagLabel);
profile.hook('update', rejectBlankDisplayName);
