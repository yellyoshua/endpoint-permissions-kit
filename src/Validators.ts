import { ALL_FIELDS, GLOBAL_HOOK_OWNER, METHODS } from './constants';
import { pkitError } from './errors';
import { resolveAction, resolveRole } from './resolve';
import type { ModuleEntry, State } from './state';
import type { ActionDefs, Context, Data, FindResult, HookFn, Method, PkitErrorCode, ResolvedPermission, Role, ValidateInput } from './types';

interface ValidationFailure {
  code: PkitErrorCode;
  message: string;
}

interface StringRules extends ValidationFailure {
  minimumLength: number;
}

interface ValidatedRequest {
  registeredModule: ModuleEntry;
  permission: ResolvedPermission;
  data: Data | undefined;
  context: Context | undefined;
  result: FindResult | Data;
}

export function validateObject(value: unknown, failure: ValidationFailure): asserts value is Data {
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

export function validateOpenRegistry(state: State): void {
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
}

export function validateModuleName(moduleName: unknown): asserts moduleName is string {
  if (typeof moduleName !== 'string' || !moduleName || moduleName.includes('.')) {
    throw pkitError('INVALID_DEFINITION', `nombre de módulo inválido: "${String(moduleName)}" (string no vacío, sin puntos)`);
  }
}

export function validateMethod(method: unknown, action: string): asserts method is Method {
  if ((METHODS as readonly unknown[]).includes(method)) return;
  throw pkitError('INVALID_DEFINITION', `${action}: método "${String(method)}" no existe. Métodos: ${METHODS.join(', ')}`);
}

export function validateActions(actions: unknown, registration: { action: string; role: string }, state: State): ActionDefs {
  const { action, role } = registration;
  validateOpenRegistry(state);
  validateRole(role, state.roles, 'ROLE_NOT_DECLARED');
  if (state.modules.get(action)?.actions.has(role)) {
    throw pkitError('DUPLICATE_REGISTRATION', `"${action}" ya tiene acciones registradas para el rol "${role}"`);
  }
  validateObject(actions, { code: 'INVALID_DEFINITION', message: `${action} [${role}]: registerActions espera un objeto` });
  const registeredActions: ActionDefs = Object.create(null);
  for (const [method, definition] of Object.entries(actions)) {
    validateMethod(method, action);
    const permissionPath = `${action} [${role}].${method}`;
    validateObject(definition, { code: 'INVALID_DEFINITION', message: `${permissionPath}: debe ser un objeto` });
    if (typeof definition.enabled !== 'boolean') {
      throw pkitError('INVALID_DEFINITION', `${permissionPath}: enabled debe ser boolean`);
    }
    const { properties } = definition;
    if (properties === ALL_FIELDS) {
      registeredActions[method] = Object.freeze({ enabled: definition.enabled, properties });
      continue;
    }
    validateStrings(properties, {
      code: 'INVALID_DEFINITION', message: `${permissionPath}: properties debe ser string[] o '*'`, minimumLength: 0,
    });
    registeredActions[method] = Object.freeze({ enabled: definition.enabled, properties: Object.freeze([...properties]) });
  }
  return Object.freeze(registeredActions);
}

export function validateHook(hook: unknown, registration: { action: string; role: string; method: Method }, state: State): asserts hook is HookFn {
  const { action, role, method } = registration;
  validateOpenRegistry(state);
  if (role !== GLOBAL_HOOK_OWNER) validateRole(role, state.roles, 'ROLE_NOT_DECLARED');
  validateMethod(method, action);
  if (typeof hook !== 'function') throw pkitError('INVALID_DEFINITION', `${action}: hook("${method}") espera una función`);
}

export function validateRegisteredHooks(modules: ReadonlyMap<string, ModuleEntry>): void {
  for (const [action, registeredModule] of modules) {
    for (const [hookRole, methodHooks] of registeredModule.hooks) {
      if (hookRole === GLOBAL_HOOK_OWNER) continue;
      for (const method of methodHooks.keys()) {
        if (resolveAction(registeredModule, hookRole, method)) continue;
        throw pkitError('INVALID_DEFINITION',
          `"${action}": hook de "${hookRole}" en "${method}" sin acciones registradas para ese rol ni para general`,
        );
      }
    }
  }
}

export function validateRequest(input: ValidateInput, state: State): ValidatedRequest {
  validateSnapshot(state.snapshot);
  const { action, method } = input;
  const role = resolveRole(input.role);
  if (method !== 'find' && Object.hasOwn(input, 'select')) {
    throw pkitError('INVALID_INPUT', 'select solo aplica en find');
  }
  validateRole(role, state.roles, 'UNKNOWN_ROLE');
  const registeredModule = state.modules.get(action);
  if (!registeredModule) throw pkitError('UNKNOWN_ACTION', `permiso "${action}" no está registrado`);
  const definition = resolveAction(registeredModule, role, method);
  if (!definition?.enabled) {
    throw pkitError('METHOD_DISABLED', `"${action}.${method}" no está habilitado para el rol "${role}"`);
  }
  const { data, context } = input;
  if (context !== undefined) validateObject(context, { code: 'INVALID_INPUT', message: 'context debe ser un objeto' });
  const { properties } = definition;
  const permission: ResolvedPermission = Object.freeze({ role, action, method, enabled: true, properties });
  if (input.method === 'find') {
    if (data !== undefined) validateObject(data, { code: 'INVALID_INPUT', message: 'data debe ser un objeto' });
    const { select } = input;
    if (select === undefined) return { registeredModule, permission, data, context, result: properties };
    validateStrings(select, { code: 'INVALID_INPUT', message: 'select debe ser un array de strings', minimumLength: 0 });
    if (properties === ALL_FIELDS) return { registeredModule, permission, data, context, result: select };
    const selectedFields: string[] = [];
    for (const field of select) {
      if (properties.includes(field)) selectedFields.push(field);
    }
    return { registeredModule, permission, data, context, result: selectedFields };
  }
  validateObject(data, { code: 'INVALID_INPUT', message: 'data debe ser un objeto' });
  if (properties !== ALL_FIELDS) {
    const forbiddenFields: string[] = [];
    for (const field of Object.keys(data)) {
      if (!properties.includes(field)) forbiddenFields.push(field);
    }
    if (forbiddenFields.length) {
      throw Object.assign(
        pkitError('PROPERTIES_NOT_ALLOWED', `campos no permitidos en "${action}.${method}" para "${role}": ${forbiddenFields.join(', ')}`),
        { fields: forbiddenFields },
      );
    }
  }
  return { registeredModule, permission, data, context, result: data };
}
