import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, NOTES_ACTION, READ_ONLY_NAME } from './permissions';
import { deleteNote, findNote, insertNote, listNotes, replaceNote, type Note } from './store';

const NOTES_ALL = { action: NOTES_ACTION, name: ALL_NAME };
const NOTES_READ_ONLY = { action: NOTES_ACTION, name: READ_ONLY_NAME };

interface ListNotesRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface NoteWriteRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface NoteUpdateRequest extends NoteWriteRequest {
  readonly id: string;
}

interface NoteRemoveRequest {
  readonly identity: Identity;
  readonly id: string;
}

export async function listAllNotes(request: ListNotesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: NOTES_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listNotes().map((note) => projectRecord(note, authorization.result)));
}

export async function listPublishedNotes(request: ListNotesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: NOTES_READ_ONLY, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listNotes().map((note) => projectRecord(note, authorization.result)));
}

export async function createNote(request: NoteWriteRequest): Promise<UseCaseResult<Note>> {
  const authorization = await authorizeWrite({
    guard: NOTES_ALL,
    identity: request.identity,
    method: 'create',
    data: request.data,
    context: { user: { id: request.identity.id }}
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertNote({
    title: String(authorization.result.title ?? ''),
    body: String(authorization.result.body ?? ''),
    pinned: authorization.result.pinned === true,
    author: request.identity.id,
  });
  return succeed(created);
}

export async function updateNote(request: NoteUpdateRequest): Promise<UseCaseResult<Note>> {
  const existing = findNote(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({
    guard: NOTES_ALL,
    identity: request.identity,
    method: 'update',
    data: request.data,
    context: { user: { id: request.identity.id }, resource: existing },
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const updated: Note = {
    ...existing,
    title: typeof authorization.result.title === 'string' ? authorization.result.title : existing.title,
    body: typeof authorization.result.body === 'string' ? authorization.result.body : existing.body,
    pinned: typeof authorization.result.pinned === 'boolean' ? authorization.result.pinned : existing.pinned,
  };
  replaceNote(updated);
  return succeed(updated);
}

export async function removeNote(request: NoteRemoveRequest): Promise<UseCaseResult<undefined>> {
  const existing = findNote(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({
    guard: NOTES_ALL,
    identity: request.identity,
    method: 'remove',
    data: { id: request.id },
    context: { user: { id: request.identity.id }, resource: existing },
  });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteNote(request.id);
  return succeed(undefined);
}
