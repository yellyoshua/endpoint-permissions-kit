import constants from './constants';
import definitions from './definitions';
import errors from './errors';
import properties from './properties';
import resolve from './resolve';
import state from './state';
import type { State } from './state';
import type { Context, Data, HookFn, PkitError, ValidateInput, ValidateResult, ValidationError } from './types';

/** What survives the trust boundary: nothing here needs to be re-checked. */
interface PreparedRequest {
  readonly hooks: readonly HookFn[];
  readonly data: Data;
  readonly context: Context;
  readonly permissions: readonly string[];
}

const validator = {
  /**
   * The request boundary. Every failure of every phase becomes one entry of the
   * returned contract, so this never throws and never answers with a partial
   * success: on any failure `result` is `null`.
   */
  async validate(input: ValidateInput): Promise<ValidateResult> {
    try {
      const request = prepareRequest(input, state.getOrCreate());
      const hookCalls: Promise<unknown>[] = [];

      for (const hook of request.hooks) hookCalls.push(invokeHook(hook, request));

      const hookResults = await Promise.allSettled(hookCalls);
      const hookErrors: ValidationError[] = [];

      for (const hookResult of hookResults) {
        if (hookResult.status === 'fulfilled') continue;

        const hookCause: unknown = hookResult.reason;

        hookErrors.push({ code: 'HOOK_ERROR', message: describeHookFailure(hookCause), cause: hookCause });
      }

      if (hookErrors.length) return { result: null, errors: Object.freeze(hookErrors) };

      return { result: { data: request.data }, errors: Object.freeze([] as const) };
    } catch (cause) {
      return { result: null, errors: Object.freeze([translateFailure(cause)]) };
    }
  },
};

/**
 * Checks the request and resolves the access it asks for, in the documented order:
 * sealed registry, input shape, identity, module, name, access and data properties.
 * The request never names a permission name: it is chosen from the assignments.
 * Throws a `PkitError`; the caller turns it into the public contract.
 */
function prepareRequest(input: ValidateInput, currentState: State): PreparedRequest {
  const snapshot = state.requireSnapshot(currentState);

  const method = definitions.checkMethod(input.method, 'INVALID_INPUT', 'method is required');
  const { action, permissions } = input;

  if (typeof action !== 'string') throw errors.create('INVALID_INPUT', 'action is required');

  const data = readOptionalObject(input.data, 'data must be an object');
  const context = readOptionalObject(input.context, 'context must be an object');

  const identity = resolve.identity(input, snapshot, currentState.roles);
  const { role, assigned } = identity;

  const registeredModule = currentState.modules.get(action);

  if (!registeredModule) throw errors.create('UNKNOWN_ACTION', `module "${action}" is not registered`);

  const chosen = resolve.permission(registeredModule, action, identity);

  if (!chosen) {
    throw errors.create('PERMISSION_NOT_ASSIGNED', `no name of module "${action}" is assigned or granted to role "${role}" by the user permissions`);
  }

  const { permissionId, entry: nameEntry } = chosen;
  const access = resolve.access(nameEntry, permissionId, role, method, assigned);

  if (access.status === 'unassigned') {
    throw errors.create('PERMISSION_NOT_ASSIGNED', `"${permissionId}" is not assigned or granted by the user permissions`);
  }

  if (access.status === 'disabled') throw errors.create('METHOD_DISABLED', `"${permissionId}.${method}" is not enabled`);

  // A declared role can never be "*", so the role bucket never collides with the name-wide one.
  const hookGroups = [
    registeredModule.hooks.get(method),
    nameEntry.hooks.get(constants.GLOBAL_HOOK_OWNER)?.get(method),
    nameEntry.hooks.get(role)?.get(method),
  ];

  const hooks: HookFn[] = [];

  for (const group of hookGroups) {
    if (group) hooks.push(...group);
  }

  return { hooks, context, permissions, data: properties.resolve(data, access.properties, currentState.cropper) };
}

/** `data` and `context` are optional and become `{}` exactly once, here. */
function readOptionalObject(value: unknown, message: string): Data {
  if (value === undefined) return {};

  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw errors.create('INVALID_INPUT', message);

  return value as Data;
}

/** Async so a hook that throws synchronously still lands as a rejection in `allSettled`. */
async function invokeHook(hook: HookFn, request: PreparedRequest): Promise<unknown> {
  return hook(request.data, request.context, request.permissions);
}

function describeHookFailure(reason: unknown): string {
  try {
    return reason instanceof Error ? reason.message : String(reason);
  } catch {
    return 'the hook threw a value that cannot be described';
  }
}

function translateFailure(cause: unknown): ValidationError {
  if (!(cause instanceof Error) || cause.name !== 'PkitError') {
    return { code: 'VALIDATION_ERROR', message: 'permission could not be validated', cause };
  }

  const permissionError = cause as PkitError;

  if (permissionError.code === 'PROPERTIES_NOT_ALLOWED') {
    return { code: permissionError.code, message: permissionError.message, fields: permissionError.fields };
  }

  return { code: permissionError.code, message: permissionError.message };
}

export default validator;
