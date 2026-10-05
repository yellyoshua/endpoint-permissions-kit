import type { Registry, Snapshot } from './registry';
import type { Context, Data, HookFn, Method, PkitError, ValidateResult, ValidationError } from './types';
import constants from './constants';
import errors from './errors';
import properties from './properties';
import resolve from './resolve';
import snapshot from './snapshot';

interface PreparedRequest {
  readonly hooks: readonly HookFn[];
  readonly data: Data;
  readonly context: Context;
  readonly permissions: readonly string[];
}

const validator = {
  async run(target: Registry, input: unknown): Promise<ValidateResult> {
    let compiled: Snapshot;

    try {
      compiled = snapshot.of(target);
    } catch (cause) {
      if (!errors.isPkitError(cause)) return { result: null, errors: Object.freeze([translateFailure(cause)]) };

      return { result: null, errors: Object.freeze([{ code: 'VALIDATION_ERROR', message: 'registry has invalid definitions', cause }]) };
    }

    try {
      const request = prepareRequest(target, compiled, input);
      const calls: Promise<unknown>[] = [];

      for (const hook of request.hooks) calls.push(invokeHook(hook, request));

      const settled = await Promise.allSettled(calls);
      const failures: ValidationError[] = [];

      for (const outcome of settled) {
        if (outcome.status === 'rejected') failures.push({ code: 'HOOK_ERROR', message: describeFailure(outcome.reason), cause: outcome.reason });
      }

      if (failures.length > 0) return { result: null, errors: Object.freeze(failures) };

      return { result: { data: request.data }, errors: Object.freeze([] as const) };
    } catch (cause) {
      return { result: null, errors: Object.freeze([translateFailure(cause)]) };
    }
  },
};

export default validator;

function prepareRequest(target: Registry, compiled: Snapshot, input: unknown): PreparedRequest {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw errors.create('INVALID_INPUT', 'validate expects an object');

  const { action, method, role, permissions } = input as Record<string, unknown>;

  if (typeof method !== 'string' || !(constants.METHODS as readonly string[]).includes(method)) {
    throw errors.create('INVALID_INPUT', `method must be one of ${constants.METHODS.join(', ')}`);
  }

  if (typeof action !== 'string') throw errors.create('INVALID_INPUT', 'action is required');

  if (typeof role !== 'string') throw errors.create('INVALID_INPUT', 'role is required');

  if (!Array.isArray(permissions)) throw errors.create('INVALID_INPUT', 'permissions must be an array of identifiers');

  const data = readOptionalObject((input as Record<string, unknown>).data, 'data');
  const context = readOptionalObject((input as Record<string, unknown>).context, 'context');

  const identity = resolve.checkIdentity(compiled, role, permissions);
  const access = resolve.resolveAccess(compiled, role, action, method as Method, identity);

  const hooks: HookFn[] = [];
  const groups = [
    compiled.modules.get(action)?.hooks.get(method as Method),
    access.entry.hooks.get(method as Method),
    access.entry.roleHooks.get(role)?.get(method as Method),
  ];

  for (const group of groups) {
    if (group !== undefined) hooks.push(...group);
  }

  if (target.cropper) return { hooks, context, permissions, data: properties.crop(data, access.properties, target.reservedFields) };

  const denied = properties.deny(data, access.properties, target.reservedFields);

  if (denied.length > 0) {
    throw Object.assign(errors.create('PROPERTIES_NOT_ALLOWED', `fields not allowed: ${denied.join(', ')}`), { fields: denied });
  }

  return { hooks, context, permissions, data };
}

function readOptionalObject(value: unknown, label: string): Data {
  if (value === undefined) return {};

  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw errors.create('INVALID_INPUT', `${label} must be an object`);

  return value as Data;
}

async function invokeHook(hook: HookFn, request: PreparedRequest): Promise<unknown> {
  return hook(request.data, request.context, request.permissions);
}

function describeFailure(reason: unknown): string {
  if (reason instanceof Error) return reason.message;

  return errors.describe(reason);
}

function translateFailure(cause: unknown): ValidationError {
  if (!errors.isPkitError(cause)) return { code: 'VALIDATION_ERROR', message: 'permission could not be validated', cause };

  const failure = cause as PkitError;

  if (failure.code === 'PROPERTIES_NOT_ALLOWED') return { code: failure.code, message: failure.message, fields: failure.fields };

  return { code: failure.code, message: failure.message };
}
