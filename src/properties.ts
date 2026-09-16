import constants from './constants';
import errors from './errors';
import type { Data, Properties } from './types';

/** Marks a node the crop removed, so its parent drops the key instead of keeping an empty container. */
const PRUNED = Symbol('pruned');

/**
 * Hard ceiling on how deep `data` may nest. Request payloads are orders of
 * magnitude shallower; the limit keeps a hostile payload from driving the walk
 * into the call stack, and it is checked instead of relying on stack size.
 */
const MAX_DEPTH = 1000;

/** A declared property path, split into segments once so matching never re-parses it. */
type PathPattern = readonly string[];

/**
 * State carried through one walk of `data`.
 * `segments` is the path of the node being visited, and `ancestors` holds the
 * containers currently open above it, which is how a cycle is detected.
 */
interface Walk {
  readonly patterns: readonly PathPattern[];
  readonly segments: string[];
  readonly ancestors: Set<object>;
}

const properties = {
  /**
   * Checks one path declared in `registerActions`.
   * Array indexes never appear in the paths of `data` (elements share their
   * container's path), and a leading wildcard would grant that leaf under every
   * root key.
   */
  checkDeclaredPath(property: string, permissionPath: string): void {
    if (property.includes('[') || property.includes(']')) {
      throw errors.create('INVALID_DEFINITION', `${permissionPath}: array indexes are not allowed in properties: "${property}"`);
    }

    const segments = segmentsOf(property);

    for (const segment of segments) {
      if (segment.length === 0) throw errors.create('INVALID_DEFINITION', `${permissionPath}: empty segment in property path: "${property}"`);
    }

    if (segments[0] === constants.ALL_FIELDS) {
      throw errors.create('INVALID_DEFINITION', `${permissionPath}: a property path cannot start with "${constants.ALL_FIELDS}": "${property}"`);
    }
  },

  /**
   * Compares the paths of `data` with the fields the permission allows.
   * Denies the request with `PROPERTIES_NOT_ALLOWED`, or returns a cropped copy
   * when the `cropper` option is on. `data` is never mutated.
   */
  resolve(data: Data, allowed: Properties, cropper: boolean): Data {
    if (allowed === constants.ALL_FIELDS) return data;

    const patterns: PathPattern[] = [];

    for (const pattern of allowed) patterns.push(segmentsOf(pattern));

    const walk: Walk = { patterns, segments: [], ancestors: new Set([data]) };

    if (cropper) return cropData(data, walk);

    rejectForbiddenPaths(data, walk);

    return data;
  },
};

/**
 * Splits a declared property path into segments; `\` escapes the next character.
 * Only declared paths reach this: `checkDeclaredPath` has already rejected the
 * bracket syntax, and the paths of `data` are walked structurally, never rendered
 * into a string first.
 */
function segmentsOf(path: string): readonly string[] {
  const segments: string[] = [];

  let segment = '';
  let index = 0;

  while (index < path.length) {
    const character = path[index] as string;

    if (character === '\\') {
      segment += path[index + 1] ?? '';
      index += 2;
      continue;
    }

    if (character === '.') {
      segments.push(segment);
      segment = '';
      index += 1;
      continue;
    }

    segment += character;
    index += 1;
  }

  segments.push(segment);

  return segments;
}

/** A pattern matches a path when both have the same depth and every segment is equal or `*`. */
function isAllowedPath(segments: readonly string[], patterns: readonly PathPattern[]): boolean {
  for (const pattern of patterns) {
    if (pattern.length !== segments.length) continue;

    let isMatch = true;

    for (let index = 0; index < segments.length; index += 1) {
      const patternSegment = pattern[index];

      if (patternSegment === constants.ALL_FIELDS) continue;
      if (patternSegment === segments[index]) continue;

      isMatch = false;
      break;
    }

    if (isMatch) return true;
  }

  return false;
}

/** Only plain objects and arrays are walked; everything else is one leaf, kept or dropped whole. */
function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function requireDepth(walk: Walk): void {
  if (walk.ancestors.size < MAX_DEPTH) return;

  throw new RangeError(`data is nested deeper than ${MAX_DEPTH} levels`);
}

/**
 * Writes one cropped field.
 * A plain assignment to `__proto__` would hit the inherited setter and either
 * change the prototype or silently lose the field, so that one key is defined.
 */
function setField(target: Data, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });

    return;
  }

  target[key] = value;
}

/**
 * Walks `data` alongside the path being built and returns the allowed part of it,
 * or `PRUNED` when nothing of this node survives.
 *
 * Array elements share their container's path, which is what drops indexes at
 * every depth. An empty container is itself a leaf, so a permission that declares
 * it keeps it; a container the crop emptied is dropped, and that cascades to its
 * parent. A cycle cannot be represented in a filtered copy, so it is refused
 * rather than copied by reference, which would hand the hooks uncropped data.
 */
function cropValue(value: unknown, walk: Walk): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return isAllowedPath(walk.segments, walk.patterns) ? [] : PRUNED;

    if (walk.ancestors.has(value)) throw new RangeError('data contains a circular reference');

    requireDepth(walk);
    walk.ancestors.add(value);

    const items: unknown[] = [];

    for (const item of value) {
      const croppedItem = cropValue(item, walk);

      if (croppedItem === PRUNED) continue;

      items.push(croppedItem);
    }

    walk.ancestors.delete(value);

    return items.length === 0 ? PRUNED : items;
  }

  if (isPlainObject(value)) {
    const container = value as Data;
    const keys = Object.keys(container);

    if (keys.length === 0) return isAllowedPath(walk.segments, walk.patterns) ? {} : PRUNED;

    if (walk.ancestors.has(container)) throw new RangeError('data contains a circular reference');

    requireDepth(walk);
    walk.ancestors.add(container);

    const cropped: Data = {};

    let keptCount = 0;

    for (const key of keys) {
      walk.segments.push(key);

      const croppedValue = cropValue(container[key], walk);

      walk.segments.pop();

      if (croppedValue === PRUNED) continue;

      setField(cropped, key, croppedValue);
      keptCount += 1;
    }

    walk.ancestors.delete(container);

    return keptCount === 0 ? PRUNED : cropped;
  }

  return isAllowedPath(walk.segments, walk.patterns) ? value : PRUNED;
}

function cropData(data: Data, walk: Walk): Data {
  const cropped: Data = {};

  for (const key of Object.keys(data)) {
    walk.segments.push(key);

    const croppedValue = cropValue(data[key], walk);

    walk.segments.pop();

    if (croppedValue === PRUNED) continue;

    setField(cropped, key, croppedValue);
  }

  return cropped;
}

/**
 * Same walk as the crop, collecting the paths outside the permission instead of
 * copying. Nothing is copied here, so a node already open above this one is
 * reported as the leaf that closes the cycle instead of being followed.
 */
function collectForbiddenPaths(value: unknown, walk: Walk, forbidden: Set<string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0 || walk.ancestors.has(value)) {
      reportPath(walk, forbidden);

      return;
    }

    requireDepth(walk);
    walk.ancestors.add(value);

    for (const item of value) collectForbiddenPaths(item, walk, forbidden);

    walk.ancestors.delete(value);

    return;
  }

  if (isPlainObject(value)) {
    const container = value as Data;
    const keys = Object.keys(container);

    if (keys.length === 0 || walk.ancestors.has(container)) {
      reportPath(walk, forbidden);

      return;
    }

    requireDepth(walk);
    walk.ancestors.add(container);

    for (const key of keys) {
      walk.segments.push(key);
      collectForbiddenPaths(container[key], walk, forbidden);
      walk.segments.pop();
    }

    walk.ancestors.delete(container);

    return;
  }

  reportPath(walk, forbidden);
}

function reportPath(walk: Walk, forbidden: Set<string>): void {
  if (isAllowedPath(walk.segments, walk.patterns)) return;

  forbidden.add(walk.segments.join('.'));
}

function rejectForbiddenPaths(data: Data, walk: Walk): void {
  const forbidden = new Set<string>();

  for (const key of Object.keys(data)) {
    walk.segments.push(key);
    collectForbiddenPaths(data[key], walk, forbidden);
    walk.segments.pop();
  }

  if (forbidden.size === 0) return;

  const fields = [...forbidden];

  throw Object.assign(
    errors.create('PROPERTIES_NOT_ALLOWED', `fields not allowed: ${fields.join(', ')}`),
    { fields },
  );
}

export default properties;
