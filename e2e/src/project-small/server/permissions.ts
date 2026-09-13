import pkit from 'endpoint-permissions-kit';
import type { Context, Data } from 'endpoint-permissions-kit';

export const MODULE_PREFIX = 'small';

export const NOTES_ACTION = 'small.notes';
export const TAGS_ACTION = 'small.tags';
export const PROFILE_ACTION = 'small.profile';

export const ALL_NAME = 'all';
export const READ_ONLY_NAME = 'read-only';

export const PINNED_NOTE_MESSAGE = 'Pinned notes cannot be removed';
export const DUPLICATE_TAG_MESSAGE = 'Tag label already exists';

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

notes.name(ALL_NAME).hook('update', (data, context) => {
  const user = context?.user as {id: string}

  if (user.id !== data?.author) throw new Error('Only own notes can be updated');
});

notes.name(ALL_NAME).hook('create', (data, context) => {
  const user = context?.user as {id: string}

  if (user.id !== data?.author) throw new Error('Only own notes can be created');
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

function rejectPinnedNoteRemoval(_data: Data | undefined, context: Context | undefined): void {
  const resource = context?.resource as { pinned?: boolean } | undefined;
  if (resource?.pinned === true) throw new Error(PINNED_NOTE_MESSAGE);
}

async function rejectDuplicateTagLabel(data: Data | undefined, context: Context | undefined): Promise<void> {
  const existingLabels = (context?.existingLabels as readonly string[] | undefined) ?? [];
  const label = data?.label;
  await Promise.resolve();
  if (typeof label === 'string' && existingLabels.includes(label)) throw new Error(DUPLICATE_TAG_MESSAGE);
}

notes.hook('remove', rejectPinnedNoteRemoval);
tags.hook('create', rejectDuplicateTagLabel);
