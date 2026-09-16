import constants from './constants';
import errors from './errors';
import type { Data, Properties } from './types';

const PRUNED = Symbol('pruned');

const MAX_DEPTH = 1000;

type PathPattern = readonly string[];

interface Walk {
  readonly patterns: readonly PathPattern[];
  readonly segments: string[];
  readonly ancestors: Set<object>;
}

const properties = {
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

  resolve(data: Data, allowed: Properties, reserved: readonly string[], cropper: boolean): Data {
    if (allowed === constants.ALL_FIELDS) return data;

    const patterns: PathPattern[] = [];

    for (const pattern of allowed.concat(reserved)) patterns.push(segmentsOf(pattern));

    const walk: Walk = { patterns, segments: [], ancestors: new Set([data]) };

    if (cropper) return cropData(data, walk);

    rejectForbiddenPaths(data, walk);

    return data;
  },
};

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

function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function requireDepth(walk: Walk): void {
  if (walk.ancestors.size < MAX_DEPTH) return;

  throw new RangeError(`data is nested deeper than ${MAX_DEPTH} levels`);
}

function setField(target: Data, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });

    return;
  }

  target[key] = value;
}

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

  const error = errors.create('PROPERTIES_NOT_ALLOWED', `fields not allowed: ${fields.join(', ')}`);

  throw Object.assign(error, { fields });
}

export default properties;
