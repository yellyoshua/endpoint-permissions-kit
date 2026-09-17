import type { ActionDef, ActionDefs, GrantDef, GrantDefs, Method } from './types';
import constants from './constants';
import errors from './errors';

const definitions = {
  readActions(literal: unknown): ActionDefs {
    const source = readLiteral(literal);
    const actions: Record<string, ActionDef> = {};

    for (const method of methodsOf(source)) {
      const entry = source[method];

      if (!isRecord(entry) || typeof entry.enabled !== 'boolean') {
        throw errors.create('INVALID_DEFINITION', `Action ${method} must declare a boolean enabled flag`);
      }

      actions[method] = Object.freeze({ enabled: entry.enabled, properties: readProperties(entry.properties, method) });
    }

    return Object.freeze(actions) as ActionDefs;
  },

  readGrant(literal: unknown): GrantDefs {
    const source = readLiteral(literal);
    const grants: Record<string, GrantDef> = {};

    for (const method of methodsOf(source)) {
      const entry = source[method];

      if (!isRecord(entry) || entry.enabled !== true) {
        throw errors.create('INVALID_DEFINITION', `Grant ${method} must be enabled: a grant is opt-in`);
      }

      const properties = readProperties(entry.properties, method);

      if (properties === constants.ALL_FIELDS) {
        throw errors.create('INVALID_DEFINITION', `Grant ${method} must list its properties explicitly`);
      }

      grants[method] = Object.freeze({ enabled: true, properties });
    }

    return Object.freeze(grants) as GrantDefs;
  },

  readPropertyPaths(paths: unknown, label: string): readonly string[] {
    if (!Array.isArray(paths)) {
      throw errors.create('INVALID_DEFINITION', `${label} must be an array of property paths`);
    }

    const checked = paths.map(function checkEach(path: unknown): string {
      return checkPropertyPath(path, label);
    });

    if (new Set(checked).size !== checked.length) {
      throw errors.create('INVALID_DEFINITION', `${label}: duplicate property path`);
    }

    return Object.freeze(checked);
  },
};

export default definitions;

function readLiteral(literal: unknown): Record<string, unknown> {
  if (!isRecord(literal)) {
    throw errors.create('INVALID_DEFINITION', `registerActions expects an object literal, received ${errors.describe(literal)}`);
  }

  return literal;
}

function methodsOf(source: Record<string, unknown>): Method[] {
  const methods: Method[] = [];

  for (const key of Object.keys(source)) {
    if (!(constants.METHODS as readonly string[]).includes(key)) {
      throw errors.create('INVALID_DEFINITION', `Unknown method: ${key}`);
    }

    methods.push(key as Method);
  }

  return methods;
}

function readProperties(value: unknown, method: string): readonly string[] | typeof constants.ALL_FIELDS {
  if (value === constants.ALL_FIELDS) return constants.ALL_FIELDS;

  return definitions.readPropertyPaths(value, `Properties of ${method}`);
}

function checkPropertyPath(path: unknown, label: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw errors.create('INVALID_DEFINITION', `${label}: property paths must be non-empty strings`);
  }

  if (path === constants.ALL_FIELDS) {
    throw errors.create('INVALID_DEFINITION', `${label}: '*' cannot appear inside a property list`);
  }

  const segments = path.split(constants.MODULE_SEPARATOR);

  if (segments[0] === constants.ALL_FIELDS) {
    throw errors.create('INVALID_DEFINITION', `${label}: a property path cannot start with a wildcard (${path})`);
  }

  for (const segment of segments) {
    if (segment.length === 0) throw errors.create('INVALID_DEFINITION', `${label}: empty segment in property path ${path}`);
    if (segment.includes('[') || segment.includes(']')) throw errors.create('INVALID_DEFINITION', `${label}: indexes are not allowed in property path ${path}`);
  }

  return path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
