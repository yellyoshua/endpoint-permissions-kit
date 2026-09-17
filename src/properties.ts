import type { Data, Properties } from './types';
import constants from './constants';

const PRUNED = Symbol('pruned');

interface Walk {
  readonly patterns: readonly (readonly string[])[];
  readonly segments: string[];
  readonly ancestors: Set<object>;
}

const properties = {
  deny(data: Data, allowed: Properties, reserved: readonly string[]): readonly string[] {
    if (allowed === constants.ALL_FIELDS) return Object.freeze([]);

    const walk = createWalk(data, allowed, reserved);
    const denied = new Set<string>();

    for (const key of Object.keys(data)) {
      walk.segments.push(key);
      collectDenied(data[key], walk, denied);
      walk.segments.pop();
    }

    return Object.freeze([...denied]);
  },

  crop(data: Data, allowed: Properties, reserved: readonly string[]): Data {
    if (allowed === constants.ALL_FIELDS) return data;

    const walk = createWalk(data, allowed, reserved);
    const cropped: Data = {};

    for (const key of Object.keys(data)) {
      walk.segments.push(key);

      const value = cropValue(data[key], walk);

      walk.segments.pop();

      if (value !== PRUNED) setField(cropped, key, value);
    }

    return cropped;
  },
};

export default properties;

function createWalk(data: Data, allowed: readonly string[], reserved: readonly string[]): Walk {
  const patterns: (readonly string[])[] = [];

  for (const path of allowed) patterns.push(path.split(constants.MODULE_SEPARATOR));
  for (const path of reserved) patterns.push(path.split(constants.MODULE_SEPARATOR));

  return { patterns, segments: [], ancestors: new Set([data]) };
}

function isAllowed(walk: Walk): boolean {
  for (const pattern of walk.patterns) {
    if (pattern.length !== walk.segments.length) continue;

    let isMatch = true;

    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] === constants.ALL_FIELDS || pattern[index] === walk.segments[index]) continue;

      isMatch = false;

      break;
    }

    if (isMatch) return true;
  }

  return false;
}

function isPlainObject(value: unknown): value is Data {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function enter(container: object, walk: Walk): void {
  if (walk.ancestors.size >= constants.MAX_DEPTH) throw new RangeError(`data is nested deeper than ${constants.MAX_DEPTH} levels`);

  walk.ancestors.add(container);
}

function setField(target: Data, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });

    return;
  }

  target[key] = value;
}

function collectDenied(value: unknown, walk: Walk, denied: Set<string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0 || walk.ancestors.has(value)) return reportLeaf(walk, denied);

    enter(value, walk);

    for (const item of value) collectDenied(item, walk, denied);

    walk.ancestors.delete(value);

    return;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);

    if (keys.length === 0 || walk.ancestors.has(value)) return reportLeaf(walk, denied);

    enter(value, walk);

    for (const key of keys) {
      walk.segments.push(key);
      collectDenied(value[key], walk, denied);
      walk.segments.pop();
    }

    walk.ancestors.delete(value);

    return;
  }

  reportLeaf(walk, denied);
}

function reportLeaf(walk: Walk, denied: Set<string>): void {
  if (!isAllowed(walk)) denied.add(walk.segments.join(constants.MODULE_SEPARATOR));
}

function cropValue(value: unknown, walk: Walk): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return isAllowed(walk) ? [] : PRUNED;

    if (walk.ancestors.has(value)) throw new RangeError('data contains a circular reference');

    enter(value, walk);

    const items: unknown[] = [];

    for (const item of value) {
      const cropped = cropValue(item, walk);

      if (cropped !== PRUNED) items.push(cropped);
    }

    walk.ancestors.delete(value);

    return items.length === 0 ? PRUNED : items;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);

    if (keys.length === 0) return isAllowed(walk) ? {} : PRUNED;

    if (walk.ancestors.has(value)) throw new RangeError('data contains a circular reference');

    enter(value, walk);

    const cropped: Data = {};

    let kept = 0;

    for (const key of keys) {
      walk.segments.push(key);

      const croppedValue = cropValue(value[key], walk);

      walk.segments.pop();

      if (croppedValue === PRUNED) continue;

      setField(cropped, key, croppedValue);
      kept += 1;
    }

    walk.ancestors.delete(value);

    return kept === 0 ? PRUNED : cropped;
  }

  return isAllowed(walk) ? value : PRUNED;
}
