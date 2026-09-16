import constants from './constants';
import errors from './errors';
import properties from './properties';
import type { ActionDef, ActionDefs, GrantDefs, Method, PkitErrorCode } from './types';

const METHODS: ReadonlySet<string> = new Set<string>(constants.METHODS);

const definitions = {
  checkMethod(method: unknown, code: PkitErrorCode, subject: string): Method {
    if (typeof method === 'string' && METHODS.has(method)) return method as Method;

    throw errors.create(code, `${subject}: method "${errors.describe(method)}" does not exist. Methods: ${constants.METHODS.join(', ')}`);
  },

  /**
   * Reads a whole `registerActions` literal and returns a frozen copy, so a later
   * mutation of the object the consumer passed cannot change what was registered.
   */
  readActions(actions: unknown, permissionPath: string): ActionDefs {
    const declared = requireObject(actions, `${permissionPath}: registerActions expects an object`);
    const registeredActions: ActionDefs = Object.create(null);

    for (const [method, definition] of Object.entries(declared)) {
      definitions.checkMethod(method, 'INVALID_DEFINITION', permissionPath);

      registeredActions[method as Method] = readActionDefinition(definition, `${permissionPath}.${method}`);
    }

    return Object.freeze(registeredActions);
  },

  /**
   * A grant is opt-in and is the authority over its own fields, so it may neither
   * disable a method nor claim every field of the receiving permission.
   */
  readGrant(actions: unknown, permissionPath: string): GrantDefs {
    const registeredActions = definitions.readActions(actions, permissionPath);

    for (const [method, definition] of Object.entries(registeredActions)) {
      if (definition.enabled !== true) {
        throw errors.create('INVALID_DEFINITION', `${permissionPath}.${method}: a grant does not allow enabled: false`);
      }

      if (definition.properties === constants.ALL_FIELDS) {
        throw errors.create('INVALID_DEFINITION', `${permissionPath}.${method}: a grant requires an explicit properties list`);
      }
    }

    return registeredActions as GrantDefs;
  },
};

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw errors.create('INVALID_DEFINITION', message);

  return value as Record<string, unknown>;
}

function readActionDefinition(definition: unknown, permissionPath: string): ActionDef {
  const action = requireObject(definition, `${permissionPath}: must be an object`);

  if (typeof action.enabled !== 'boolean') {
    throw errors.create('INVALID_DEFINITION', `${permissionPath}: enabled must be a boolean`);
  }

  if (action.properties === constants.ALL_FIELDS) {
    return Object.freeze({ enabled: action.enabled, properties: constants.ALL_FIELDS });
  }

  return Object.freeze({ enabled: action.enabled, properties: readDeclaredProperties(action.properties, permissionPath) });
}

function readDeclaredProperties(value: unknown, permissionPath: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw errors.create('INVALID_DEFINITION', `${permissionPath}: properties must be string[] or '${constants.ALL_FIELDS}'`);
  }

  for (const property of value) {
    if (typeof property !== 'string' || property.length === 0) {
      throw errors.create('INVALID_DEFINITION', `${permissionPath}: properties must be string[] or '${constants.ALL_FIELDS}'`);
    }
  }

  const declared = value as readonly string[];

  if (declared.includes(constants.ALL_FIELDS)) {
    throw errors.create('INVALID_DEFINITION', `${permissionPath}: '${constants.ALL_FIELDS}' is only allowed as the whole properties value`);
  }

  if (new Set(declared).size !== declared.length) {
    throw errors.create('INVALID_DEFINITION', `${permissionPath}: properties contains duplicate fields`);
  }

  for (const property of declared) properties.checkDeclaredPath(property, permissionPath);

  return Object.freeze([...declared]);
}

export default definitions;
