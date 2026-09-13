import { ALL_FIELDS, GLOBAL_HOOK_OWNER, METHODS, MODULE_SEPARATOR, PERMISSION_ID_SEPARATOR } from './constants';
import { pkitError } from './errors';
import { permissionIdOf, resolveAccess } from './resolve';
import type { GrantEntry, ModuleEntry, NameEntry, PermissionReference, State } from './state';
import type { ActionDef, ActionDefs, Context, Data, FindResult, GrantDefs, HookFn, Method, PkitErrorCode, ResolvedPermission, Role, UserAssignments, ValidateInput } from './types';

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
  if (key !== 'roles') throw pkitError('INVALID_DEFINITION', `clave de contexto desconocida: "${String(key)}"`);
}

function validateOpenRegistry(state: State): void {
  if (state.snapshot) throw pkitError('SEALED', 'pkit.seal() ya fue llamado: no se admiten más registros');
}

export function validateSnapshot<Snapshot>(snapshot: Snapshot | null): asserts snapshot is Snapshot {
  if (snapshot === null) {
    throw pkitError('NOT_SEALED', 'falta pkit.seal(): llámalo después de importar todos los archivos de permisos');
  }
}

export function validateRole(role: unknown, roles: ReadonlySet<string>, code: 'ROLE_NOT_DECLARED' | 'UNKNOWN_ROLE'): asserts role is Role {
  if (typeof role === 'string' && roles.has(role)) return;

  if (code === 'ROLE_NOT_DECLARED') {
    throw pkitError(code,
      `role "${String(role)}" no está declarado. Roles disponibles: ${[...roles].join(', ')}.\n` +
      "¿Falta pkit.context.set('roles', [...]) en pkit.config.js, o se importó antes que este archivo?",
    );
  }

  throw pkitError(code, `rol "${String(role)}" no está declarado`);
}

export function validateRoleCatalog(roles: unknown, state: State): asserts roles is readonly string[] {
  validateOpenRegistry(state);

  if (state.modules.size) {
    throw pkitError('INVALID_DEFINITION', 'los roles se declaran antes de registrar permisos: importa pkit.config.js primero');
  }

  validateStrings(roles, {
    code: 'INVALID_DEFINITION', message: 'roles debe ser un array de strings no vacíos', minimumLength: 1,
  });

  if (roles.includes(GLOBAL_HOOK_OWNER)) {
    throw pkitError('INVALID_DEFINITION',
      `"${GLOBAL_HOOK_OWNER}" está reservado para los hooks globales y no puede declararse como rol`,
    );
  }
}

function isCleanSegment(value: string): boolean {
  return value.length > 0 && value.trim() === value && !value.includes(':');
}

export function validateModuleName(moduleName: unknown): asserts moduleName is string {
  if (typeof moduleName === 'string' && isCleanSegment(moduleName) && !moduleName.includes(MODULE_SEPARATOR)) return;

  throw pkitError('INVALID_DEFINITION',
    `nombre de módulo inválido: "${String(moduleName)}" (string no vacío, sin puntos, sin ":" ni espacios en los extremos)`,
  );
}

export function validatePermissionName(name: unknown): asserts name is string {
  if (typeof name === 'string' && isCleanSegment(name) && name !== GLOBAL_HOOK_OWNER) return;

  throw pkitError('INVALID_DEFINITION',
    `nombre de permiso inválido: "${String(name)}" (string no vacío, sin ":" ni espacios en los extremos; "*" está reservado)`,
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

function validateMethod(method: unknown, permissionPath: string): asserts method is Method {
  if ((METHODS as readonly unknown[]).includes(method)) return;

  throw pkitError('INVALID_DEFINITION', `${permissionPath}: método "${String(method)}" no existe. Métodos: ${METHODS.join(', ')}`);
}

function readActionDefinition(definition: unknown, permissionPath: string): ActionDef {
  validateObject(definition, { code: 'INVALID_DEFINITION', message: `${permissionPath}: debe ser un objeto` });

  if (typeof definition.enabled !== 'boolean') {
    throw pkitError('INVALID_DEFINITION', `${permissionPath}: enabled debe ser boolean`);
  }

  const { properties } = definition;
  if (properties === ALL_FIELDS) return Object.freeze({ enabled: definition.enabled, properties });

  validateStrings(properties, {
    code: 'INVALID_DEFINITION', message: `${permissionPath}: properties debe ser string[] o '*'`, minimumLength: 0,
  });

  return Object.freeze({ enabled: definition.enabled, properties: Object.freeze([...properties]) });
}

function readActionDefinitions(actions: unknown, permissionPath: string): ActionDefs {
  validateObject(actions, { code: 'INVALID_DEFINITION', message: `${permissionPath}: registerActions espera un objeto` });

  const registeredActions: ActionDefs = Object.create(null);
  for (const [method, definition] of Object.entries(actions)) {
    validateMethod(method, permissionPath);
    registeredActions[method] = readActionDefinition(definition, `${permissionPath}.${method}`);
  }

  return Object.freeze(registeredActions);
}

export function validateActions(actions: unknown, registration: DirectRegistration, state: State): ActionDefs {
  const { action, name, role } = registration;
  validateOpenRegistry(state);
  validateRole(role, state.roles, 'ROLE_NOT_DECLARED');

  if (state.modules.get(action)?.names.get(name)?.actions.has(role)) {
    throw pkitError('DUPLICATE_REGISTRATION', `"${action}::${name}" ya tiene acciones registradas para el rol "${role}"`);
  }

  return readActionDefinitions(actions, `${action}::${name} [${role}]`);
}

export function validateGrantActions(actions: unknown, registration: GrantRegistration, state: State): GrantEntry {
  const { action, name, permissionId } = registration;
  validateOpenRegistry(state);

  const source = parsePermissionId(permissionId, {
    code: 'INVALID_DEFINITION',
    message: `"${action}::${name}": identificador de grantTo inválido: "${String(permissionId)}" (formato rol::módulo::nombre)`,
  });
  validateRole(source.role, state.roles, 'ROLE_NOT_DECLARED');

  if (source.action === action && source.name === name) {
    throw pkitError('INVALID_DEFINITION', `"${permissionId}" no puede concederse a sí mismo`);
  }

  if (state.modules.get(action)?.names.get(name)?.grants.has(permissionId)) {
    throw pkitError('DUPLICATE_REGISTRATION', `"${action}::${name}" ya tiene una concesión para "${permissionId}"`);
  }

  const permissionPath = `${action}::${name} [grantTo ${permissionId}]`;
  const registeredActions = readActionDefinitions(actions, permissionPath);

  for (const [method, definition] of Object.entries(registeredActions)) {
    if (definition.enabled !== true) {
      throw pkitError('INVALID_DEFINITION', `${permissionPath}.${method}: una concesión no admite enabled: false`);
    }

    if (definition.properties === ALL_FIELDS) {
      throw pkitError('INVALID_DEFINITION', `${permissionPath}.${method}: una concesión exige una lista explícita de properties`);
    }
  }

  return { source, actions: registeredActions as GrantDefs };
}

export function validateHook(hook: unknown, registration: HookRegistration, state: State): asserts hook is HookFn {
  const { action, name, role, method } = registration;
  validateOpenRegistry(state);

  if (role !== undefined && role !== GLOBAL_HOOK_OWNER) validateRole(role, state.roles, 'ROLE_NOT_DECLARED');

  const permissionPath = name === undefined ? action : `${action}::${name}`;
  validateMethod(method, permissionPath);

  if (typeof hook !== 'function') throw pkitError('INVALID_DEFINITION', `${permissionPath}: hook("${method}") espera una función`);
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
      throw pkitError('INVALID_DEFINITION', `"${permissionPath}": grantTo "${permissionId}" referencia un permiso sin acciones registradas`);
    }

    for (const method of Object.keys(grant.actions)) {
      if (declaresMethod(nameEntry, method)) continue;

      throw pkitError('INVALID_DEFINITION',
        `"${permissionPath}": grantTo "${permissionId}" concede "${method}", que ningún rol declara en ese permiso`,
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
        `"${permissionPath}": hook de "${hookRole}" en "${method}" sin acciones registradas ni concesión para ese rol`,
      );
    }
  }
}

export function validateSealedRegistry(modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [action, registeredModule] of modules) {
    for (const [name, nameEntry] of registeredModule.names) {
      const permissionPath = `${action}::${name}`;

      if (nameEntry.actions.size === 0) {
        throw pkitError('INVALID_DEFINITION', `"${permissionPath}" no tiene acciones registradas para ningún rol`);
      }

      validateGrantReferences(permissionPath, nameEntry, modules);
      validateRoleHooks(permissionPath, nameEntry);
    }
  }
}

function validateAssignments(permissions: unknown, role: string, assignable: ReadonlySet<string>): ReadonlySet<string> {
  validateStrings(permissions, { code: 'INVALID_INPUT', message: 'permissions debe ser un array de strings', minimumLength: 1 });

  const assigned = new Set<string>();
  for (const permissionId of permissions) {
    const reference = parsePermissionId(permissionId, {
      code: 'INVALID_INPUT', message: `identificador de permiso inválido: "${permissionId}" (formato rol::módulo::nombre)`,
    });

    if (reference.role !== role) {
      throw pkitError('PERMISSION_ROLE_MISMATCH', `"${permissionId}" pertenece al rol "${reference.role}", no al rol autenticado "${role}"`);
    }

    if (!assignable.has(permissionId)) {
      throw pkitError('UNKNOWN_PERMISSION', `"${permissionId}" no existe como permiso asignable`);
    }

    assigned.add(permissionId);
  }

  return assigned;
}

export function validateIdentity(assignments: UserAssignments, state: State): Identity {
  validateSnapshot(state.snapshot);

  const { role, permissions } = assignments;
  if (typeof role !== 'string') throw pkitError('INVALID_INPUT', 'role es obligatorio');
  validateRole(role, state.roles, 'UNKNOWN_ROLE');

  return { role, assigned: validateAssignments(permissions, role, state.snapshot.assignable) };
}

function trimSelection(select: unknown, properties: readonly string[]): readonly string[] {
  validateStrings(select, { code: 'INVALID_INPUT', message: 'select debe ser un array de strings', minimumLength: 0 });

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
    pkitError('PROPERTIES_NOT_ALLOWED', `campos no permitidos en "${permissionPath}": ${forbiddenFields.join(', ')}`),
    { fields: forbiddenFields },
  );
}

export function validateRequest(input: ValidateInput, state: State): ValidatedRequest {
  validateSnapshot(state.snapshot);

  const { action, name, method } = input;
  if (method !== 'find' && Object.hasOwn(input, 'select')) throw pkitError('INVALID_INPUT', 'select solo aplica en find');
  if (typeof action !== 'string' || typeof name !== 'string') throw pkitError('INVALID_INPUT', 'action y name son obligatorios');

  const { role, assigned } = validateIdentity(input, state);

  const registeredModule = state.modules.get(action);
  if (!registeredModule) throw pkitError('UNKNOWN_ACTION', `módulo "${action}" no está registrado`);

  const nameEntry = registeredModule.names.get(name);
  if (!nameEntry) throw pkitError('UNKNOWN_PERMISSION', `permiso "${action}::${name}" no está registrado`);

  const permissionId = permissionIdOf(role, action, name);
  const access = resolveAccess(nameEntry, permissionId, role, method, assigned);
  if (access.status === 'unassigned') {
    throw pkitError('PERMISSION_NOT_ASSIGNED', `"${permissionId}" no está asignado ni concedido por los permisos del usuario`);
  }
  if (access.status === 'disabled') throw pkitError('METHOD_DISABLED', `"${permissionId}.${method}" no está habilitado`);

  const { data, context } = input;
  if (context !== undefined) validateObject(context, { code: 'INVALID_INPUT', message: 'context debe ser un objeto' });

  const { properties, authorization } = access;
  const permission: ResolvedPermission = Object.freeze({ role, action, name, permissionId, method, enabled: true, properties, authorization });
  const request = { registeredModule, nameEntry, permission, data, context };

  if (input.method === 'find') {
    if (data !== undefined) validateObject(data, { code: 'INVALID_INPUT', message: 'data debe ser un objeto' });

    const { select } = input;
    if (select === undefined) return { ...request, result: properties };
    if (properties === ALL_FIELDS) {
      validateStrings(select, { code: 'INVALID_INPUT', message: 'select debe ser un array de strings', minimumLength: 0 });
      return { ...request, result: select };
    }

    return { ...request, result: trimSelection(select, properties) };
  }

  validateObject(data, { code: 'INVALID_INPUT', message: 'data debe ser un objeto' });
  if (properties !== ALL_FIELDS) rejectForbiddenFields(data, properties, `${permissionId}.${method}`);

  return { ...request, result: data };
}
