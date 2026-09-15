import { ALL_FIELDS, GLOBAL_HOOK_OWNER, METHODS, MODULE_SEPARATOR, PERMISSION_ID_SEPARATOR } from './constants';
import { pkitError } from './errors';
import { permissionIdOf, resolveAccess } from './resolve';
import type { GrantEntry, ModuleEntry, NameEntry, PermissionReference, State } from './state';
import type { ActionDef, ActionDefs, Context, Data, FindInput, FindResult, GrantDefs, HookFn, Method, PkitErrorCode, ResolvedPermission, Role, UserAssignments, ValidateInput } from './types';

interface ValidationFailure {
  code: PkitErrorCode;
  message: string;
}

interface StringRules extends ValidationFailure {
  minimumLength: number;
}

interface DirectRegistration {
  action: string;
  name: string;
  role: string;
}

interface GrantRegistration {
  action: string;
  name: string;
  permissionId: string;
}

interface HookRegistration {
  action: string;
  name?: string;
  role?: string;
  method: Method;
}

interface Identity {
  role: Role;
  assigned: ReadonlySet<string>;
}

interface ValidatedRequest {
  registeredModule: ModuleEntry;
  nameEntry: NameEntry;
  permission: ResolvedPermission;
  data: Data | undefined;
  context: Context | undefined;
  result: FindResult | Data;
}

function validateObject(value: unknown, failure: ValidationFailure): asserts value is Data {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw pkitError(failure.code, failure.message);
  }
}

export function validateStrings(value: unknown, rules: StringRules): asserts value is readonly string[] {
  if (!Array.isArray(value)) throw pkitError(rules.code, rules.message);

  for (const field of value) {
    if (typeof field !== 'string' || field.length < rules.minimumLength) {
      throw pkitError(rules.code, rules.message);
    }
  }
}

export function validateContextKey(key: unknown): asserts key is 'roles' {
  if (key !== 'roles') throw pkitError('INVALID_DEFINITION', `unknown context key: "${String(key)}"`);
}

function validateOpenRegistry(state: State): void {
  if (state.snapshot) throw pkitError('SEALED', 'pkit.seal() was already called: no more registrations allowed');
}

export function validateSnapshot<Snapshot>(snapshot: Snapshot | null): asserts snapshot is Snapshot {
  if (snapshot === null) {
    throw pkitError('NOT_SEALED', 'pkit.seal() has not been called: call it after importing every permission file');
  }
}

export function validateRole(role: unknown, roles: ReadonlySet<string>, code: 'ROLE_NOT_DECLARED' | 'UNKNOWN_ROLE'): asserts role is Role {
  if (typeof role === 'string' && roles.has(role)) return;

  if (code === 'ROLE_NOT_DECLARED') {
    throw pkitError(code,
      `role "${String(role)}" is not declared. Available roles: ${[...roles].join(', ')}.\n` +
      "Is pkit.context.set('roles', [...]) missing from pkit.config.js, or was it imported after this file?",
    );
  }

  throw pkitError(code, `role "${String(role)}" is not declared`);
}

export function validateRoleCatalog(roles: unknown, state: State): asserts roles is readonly string[] {
  validateOpenRegistry(state);

  if (state.modules.size) {
    throw pkitError('INVALID_DEFINITION', 'roles must be declared before registering permissions: import pkit.config.js first');
  }

  validateStrings(roles, {
    code: 'INVALID_DEFINITION', message: 'roles must be an array of non-empty strings', minimumLength: 1,
  });

  if (roles.length === 0) throw pkitError('INVALID_DEFINITION', 'roles must declare at least one role');

  for (const role of roles) validateRoleSegment(role);
}

function isCleanSegment(value: string): boolean {
  return value.length > 0 && value.trim() === value && !value.includes(':');
}

export function validateRoleSegment(role: unknown): asserts role is string {
  if (typeof role === 'string' && isCleanSegment(role) && role !== GLOBAL_HOOK_OWNER) return;

  throw pkitError('INVALID_DEFINITION',
    `invalid role: "${String(role)}" (non-empty string, no ":" or surrounding whitespace; "${GLOBAL_HOOK_OWNER}" is reserved for global hooks)`,
  );
}

export function validateModuleName(moduleName: unknown): asserts moduleName is string {
  if (typeof moduleName === 'string' && isCleanSegment(moduleName) && !moduleName.includes(MODULE_SEPARATOR)) return;

  throw pkitError('INVALID_DEFINITION',
    `invalid module name: "${String(moduleName)}" (non-empty string, no dots, no ":" or surrounding whitespace)`,
  );
}

export function validatePermissionName(name: unknown): asserts name is string {
  if (typeof name === 'string' && isCleanSegment(name) && name !== GLOBAL_HOOK_OWNER) return;

  throw pkitError('INVALID_DEFINITION',
    `invalid permission name: "${String(name)}" (non-empty string, no ":" or surrounding whitespace; "*" is reserved)`,
  );
}

export function parsePermissionId(value: unknown, failure: ValidationFailure): PermissionReference {
  if (typeof value !== 'string') throw pkitError(failure.code, failure.message);

  const parts = value.split(PERMISSION_ID_SEPARATOR);
  const [role, action, name] = parts;

  if (parts.length !== 3 || role === undefined || action === undefined || name === undefined) {
    throw pkitError(failure.code, failure.message);
  }

  const isValidRole = isCleanSegment(role) && role !== GLOBAL_HOOK_OWNER;
  const isValidName = isCleanSegment(name) && name !== GLOBAL_HOOK_OWNER;
  const isValidAction = action.split(MODULE_SEPARATOR).every(isCleanSegment);

  if (!isValidRole || !isValidName || !isValidAction) throw pkitError(failure.code, failure.message);

  return { role, action, name };
}

function validateMethod(method: unknown, failure: ValidationFailure): asserts method is Method {
  if ((METHODS as readonly unknown[]).includes(method)) return;

  throw pkitError(failure.code, `${failure.message}: method "${String(method)}" does not exist. Methods: ${METHODS.join(', ')}`);
}

function readActionDefinition(definition: unknown, permissionPath: string): ActionDef {
  validateObject(definition, { code: 'INVALID_DEFINITION', message: `${permissionPath}: must be an object` });

  if (typeof definition.enabled !== 'boolean') {
    throw pkitError('INVALID_DEFINITION', `${permissionPath}: enabled must be a boolean`);
  }

  const { properties } = definition;

  if (properties === ALL_FIELDS) return Object.freeze({ enabled: definition.enabled, properties });

  validateStrings(properties, {
    code: 'INVALID_DEFINITION', message: `${permissionPath}: properties must be string[] or '*'`, minimumLength: 1,
  });

  if (properties.includes(ALL_FIELDS)) {
    throw pkitError('INVALID_DEFINITION', `${permissionPath}: '${ALL_FIELDS}' is only allowed as the whole properties value`);
  }

  if (new Set(properties).size !== properties.length) {
    throw pkitError('INVALID_DEFINITION', `${permissionPath}: properties contains duplicate fields`);
  }

  return Object.freeze({ enabled: definition.enabled, properties: Object.freeze([...properties]) });
}

function readActionDefinitions(actions: unknown, permissionPath: string): ActionDefs {
  validateObject(actions, { code: 'INVALID_DEFINITION', message: `${permissionPath}: registerActions expects an object` });

  const registeredActions: ActionDefs = Object.create(null);

  for (const [method, definition] of Object.entries(actions)) {
    validateMethod(method, { code: 'INVALID_DEFINITION', message: permissionPath });
    registeredActions[method] = readActionDefinition(definition, `${permissionPath}.${method}`);
  }

  return Object.freeze(registeredActions);
}

export function validateActions(actions: unknown, registration: DirectRegistration, state: State): ActionDefs {
  const { action, name, role } = registration;

  validateOpenRegistry(state);
  validateRole(role, state.roles, 'ROLE_NOT_DECLARED');

  if (state.modules.get(action)?.names.get(name)?.actions.has(role)) {
    throw pkitError('DUPLICATE_REGISTRATION', `"${action}::${name}" already has actions registered for role "${role}"`);
  }

  return readActionDefinitions(actions, `${action}::${name} [${role}]`);
}

export function validateGrantActions(actions: unknown, registration: GrantRegistration, state: State): GrantEntry {
  const { action, name, permissionId } = registration;

  validateOpenRegistry(state);

  const source = parsePermissionId(permissionId, {
    code: 'INVALID_DEFINITION',
    message: `"${action}::${name}": invalid grantTo identifier: "${String(permissionId)}" (format role::module::name)`,
  });

  validateRole(source.role, state.roles, 'ROLE_NOT_DECLARED');

  if (source.action === action && source.name === name) {
    throw pkitError('INVALID_DEFINITION', `"${permissionId}" cannot grant to itself`);
  }

  if (state.modules.get(action)?.names.get(name)?.grants.has(permissionId)) {
    throw pkitError('DUPLICATE_REGISTRATION', `"${action}::${name}" already has a grant for "${permissionId}"`);
  }

  const permissionPath = `${action}::${name} [grantTo ${permissionId}]`;
  const registeredActions = readActionDefinitions(actions, permissionPath);

  for (const [method, definition] of Object.entries(registeredActions)) {
    if (definition.enabled !== true) {
      throw pkitError('INVALID_DEFINITION', `${permissionPath}.${method}: a grant does not allow enabled: false`);
    }

    if (definition.properties === ALL_FIELDS) {
      throw pkitError('INVALID_DEFINITION', `${permissionPath}.${method}: a grant requires an explicit properties list`);
    }
  }

  return { source, actions: registeredActions as GrantDefs };
}

export function validateHook(hook: unknown, registration: HookRegistration, state: State): asserts hook is HookFn {
  const { action, name, role, method } = registration;

  validateOpenRegistry(state);

  if (role !== undefined && role !== GLOBAL_HOOK_OWNER) validateRole(role, state.roles, 'ROLE_NOT_DECLARED');

  const permissionPath = name === undefined ? action : `${action}::${name}`;

  validateMethod(method, { code: 'INVALID_DEFINITION', message: permissionPath });

  if (typeof hook !== 'function') throw pkitError('INVALID_DEFINITION', `${permissionPath}: hook("${method}") expects a function`);
}

function declaresMethod(nameEntry: NameEntry, method: string): boolean {
  for (const actions of nameEntry.actions.values()) {
    if (Object.hasOwn(actions, method)) return true;
  }

  return false;
}

function hasAccessPath(nameEntry: NameEntry, role: string, method: Method): boolean {
  if (nameEntry.actions.get(role)?.[method]) return true;

  for (const grant of nameEntry.grants.values()) {
    if (grant.source.role === role && grant.actions[method]) return true;
  }

  return false;
}

function validateGrantReferences(permissionPath: string, nameEntry: NameEntry, modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [permissionId, grant] of nameEntry.grants) {
    const sourceEntry = modules.get(grant.source.action)?.names.get(grant.source.name);

    if (!sourceEntry?.actions.has(grant.source.role)) {
      throw pkitError('INVALID_DEFINITION', `"${permissionPath}": grantTo "${permissionId}" references a permission with no registered actions`);
    }

    for (const method of Object.keys(grant.actions)) {
      if (declaresMethod(nameEntry, method)) continue;

      throw pkitError('INVALID_DEFINITION',
        `"${permissionPath}": grantTo "${permissionId}" grants "${method}", which no role declares on that permission`,
      );
    }
  }
}

function validateRoleHooks(permissionPath: string, nameEntry: NameEntry): void {
  for (const [hookRole, methodHooks] of nameEntry.hooks) {
    if (hookRole === GLOBAL_HOOK_OWNER) continue;

    for (const method of methodHooks.keys()) {
      if (hasAccessPath(nameEntry, hookRole, method)) continue;

      throw pkitError('INVALID_DEFINITION',
        `"${permissionPath}": hook for "${hookRole}" on "${method}" has no registered actions or grant for that role`,
      );
    }
  }
}

export function validateSealedRegistry(modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [action, registeredModule] of modules) {
    if (registeredModule.names.size === 0) {
      throw pkitError('INVALID_DEFINITION', `"${action}" has hooks but no name with registered actions`);
    }

    for (const [name, nameEntry] of registeredModule.names) {
      const permissionPath = `${action}::${name}`;

      if (nameEntry.actions.size === 0) {
        throw pkitError('INVALID_DEFINITION', `"${permissionPath}" has no registered actions for any role`);
      }

      validateGrantReferences(permissionPath, nameEntry, modules);
      validateRoleHooks(permissionPath, nameEntry);
    }
  }
}

function validateAssignments(permissions: unknown, role: string, assignable: ReadonlySet<string>): ReadonlySet<string> {
  validateStrings(permissions, { code: 'INVALID_INPUT', message: 'permissions must be an array of strings', minimumLength: 1 });

  const assigned = new Set<string>();

  for (const permissionId of permissions) {
    const reference = parsePermissionId(permissionId, {
      code: 'INVALID_INPUT', message: `invalid permission identifier: "${permissionId}" (format role::module::name)`,
    });

    if (reference.role !== role) {
      throw pkitError('PERMISSION_ROLE_MISMATCH', `"${permissionId}" belongs to role "${reference.role}", not the authenticated role "${role}"`);
    }

    if (!assignable.has(permissionId)) {
      throw pkitError('UNKNOWN_PERMISSION', `"${permissionId}" is not an assignable permission`);
    }

    assigned.add(permissionId);
  }

  return assigned;
}

export function validateIdentity(assignments: UserAssignments, state: State): Identity {
  validateSnapshot(state.snapshot);

  const { role, permissions } = assignments;

  if (typeof role !== 'string') throw pkitError('INVALID_INPUT', 'role is required');
  validateRole(role, state.roles, 'UNKNOWN_ROLE');

  return { role, assigned: validateAssignments(permissions, role, state.snapshot.assignable) };
}

function trimSelection(select: unknown, properties: readonly string[]): readonly string[] {
  validateStrings(select, { code: 'INVALID_INPUT', message: 'select must be an array of strings', minimumLength: 0 });

  const selectedFields: string[] = [];

  for (const field of select) {
    if (properties.includes(field)) selectedFields.push(field);
  }

  return selectedFields;
}

function rejectForbiddenFields(data: Data, properties: readonly string[], permissionPath: string): void {
  const forbiddenFields: string[] = [];

  for (const field of Object.keys(data)) {
    if (!properties.includes(field)) forbiddenFields.push(field);
  }

  if (forbiddenFields.length === 0) return;

  throw Object.assign(
    pkitError('PROPERTIES_NOT_ALLOWED', `fields not allowed in "${permissionPath}": ${forbiddenFields.join(', ')}`),
    { fields: forbiddenFields },
  );
}

export function validateRequest(input: ValidateInput, state: State): ValidatedRequest {
  validateSnapshot(state.snapshot);

  const { action, name, method } = input;

  validateMethod(method, { code: 'INVALID_INPUT', message: 'method is required' });
  if (method !== 'find' && Object.hasOwn(input, 'select')) throw pkitError('INVALID_INPUT', 'select only applies to find');
  if (typeof action !== 'string' || typeof name !== 'string') throw pkitError('INVALID_INPUT', 'action and name are required');

  const { role, assigned } = validateIdentity(input, state);

  const registeredModule = state.modules.get(action);

  if (!registeredModule) throw pkitError('UNKNOWN_ACTION', `module "${action}" is not registered`);

  const nameEntry = registeredModule.names.get(name);
  if (!nameEntry) throw pkitError('UNKNOWN_PERMISSION', `permission "${action}::${name}" is not registered`);

  const permissionId = permissionIdOf(role, action, name);
  const access = resolveAccess(nameEntry, permissionId, role, method, assigned);

  if (access.status === 'unassigned') {
    throw pkitError('PERMISSION_NOT_ASSIGNED', `"${permissionId}" is not assigned or granted by the user permissions`);
  }

  if (access.status === 'disabled') throw pkitError('METHOD_DISABLED', `"${permissionId}.${method}" is not enabled`);

  const { data, context } = input;

  if (context !== undefined) validateObject(context, { code: 'INVALID_INPUT', message: 'context must be an object' });

  const { properties, authorization } = access;
  const permission: ResolvedPermission = Object.freeze({ role, action, name, permissionId, method, enabled: true, properties, authorization });
  const request = { registeredModule, nameEntry, permission, data, context };

  if (method === 'find') {
    if (data !== undefined) validateObject(data, { code: 'INVALID_INPUT', message: 'data must be an object' });

    const { select } = input as FindInput;

    if (select === undefined) return { ...request, result: properties };
    if (properties === ALL_FIELDS) {
      validateStrings(select, { code: 'INVALID_INPUT', message: 'select must be an array of strings', minimumLength: 0 });
      return { ...request, result: select };
    }

    return { ...request, result: trimSelection(select, properties) };
  }

  validateObject(data, { code: 'INVALID_INPUT', message: 'data must be an object' });
  if (properties !== ALL_FIELDS) rejectForbiddenFields(data, properties, `${permissionId}.${method}`);

  return { ...request, result: data };
}
