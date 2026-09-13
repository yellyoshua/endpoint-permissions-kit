import type { Resource } from './collection';
import {
  ALL_NAME,
  BLOCKS_ACTION,
  ENTRIES_ACTION,
  MEMBERS_ACTION,
  NOTES_ACTION,
  PAGES_ACTION,
  PUBLISHED_NAME,
  READ_ONLY_NAME,
  REPLIES_ACTION,
  REPORTS_ACTION,
  SETTINGS_ACTION,
  SUMMARY_NAME,
} from './permissions';
import { blocks, contactNotes, entries, members, pages, replies, reports, tenants } from './store';

export const SETTINGS_ALL: Resource = { guard: { action: SETTINGS_ACTION, name: ALL_NAME }, collection: tenants };
export const MEMBERS_ALL: Resource = { guard: { action: MEMBERS_ACTION, name: ALL_NAME }, collection: members };
export const NOTES_ALL: Resource = { guard: { action: NOTES_ACTION, name: ALL_NAME }, collection: contactNotes };
export const NOTES_READ_ONLY: Resource = { guard: { action: NOTES_ACTION, name: READ_ONLY_NAME }, collection: contactNotes };
export const REPLIES_ALL: Resource = { guard: { action: REPLIES_ACTION, name: ALL_NAME }, collection: replies };
export const ENTRIES_ALL: Resource = { guard: { action: ENTRIES_ACTION, name: ALL_NAME }, collection: entries };
export const ENTRIES_SUMMARY: Resource = { guard: { action: ENTRIES_ACTION, name: SUMMARY_NAME }, collection: entries };
export const PAGES_PUBLISHED: Resource = { guard: { action: PAGES_ACTION, name: PUBLISHED_NAME }, collection: pages };
export const BLOCKS_ALL: Resource = { guard: { action: BLOCKS_ACTION, name: ALL_NAME }, collection: blocks };
export const REPORTS_ALL: Resource = { guard: { action: REPORTS_ACTION, name: ALL_NAME }, collection: reports };
export const REPORTS_READ_ONLY: Resource = { guard: { action: REPORTS_ACTION, name: READ_ONLY_NAME }, collection: reports };
