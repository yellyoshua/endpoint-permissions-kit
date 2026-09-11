import type { Context, Data, FindInput, FindResult, HookFn, ResolvedPermission, ValidateInput, ValidateResult, ValidationError, WriteInput } from './types';
import { GLOBAL_HOOK_OWNER } from './constants';
import { getOrCreateState } from './state';
import type { PkitError } from './errors';
import { validateRequest } from './Validators';

interface HookCall {
  data: Data | undefined;
  context: Context | undefined;
  permission: ResolvedPermission;
}

async function invokeHook(hook: HookFn, request: HookCall): Promise<unknown> {
  return hook(request.data, request.context, request.permission);
}

export function validate(input: FindInput): Promise<ValidateResult<FindResult>>;
export function validate<RequestData extends Data>(input: WriteInput<RequestData>): Promise<ValidateResult<RequestData>>;
export async function validate(input: ValidateInput): Promise<ValidateResult<FindResult | Data>> {
  try {
    const request = validateRequest(input, getOrCreateState());
    const { registeredModule, permission, result } = request;
    const hookCalls: Promise<unknown>[] = [];
    for (const hookRole of [GLOBAL_HOOK_OWNER, permission.role]) {
      const hooks = registeredModule.hooks.get(hookRole)?.get(permission.method);
      if (!hooks) continue;
      for (const hook of hooks) hookCalls.push(invokeHook(hook, request));
    }
    const hookResults = await Promise.allSettled(hookCalls);
    const errors: ValidationError[] = [];
    for (const hookResult of hookResults) {
      if (hookResult.status === 'fulfilled') continue;
      const hookCause: unknown = hookResult.reason;
      errors.push({
        code: 'HOOK_ERROR',
        message: hookCause instanceof Error ? hookCause.message : String(hookCause),
        cause: hookCause,
      });
    }
    if (errors.length) return { result: null, errors: Object.freeze(errors) };
    return { result, errors: Object.freeze([] as const) };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'PkitError') {
      const permissionError = cause as PkitError;
      const error: ValidationError = permissionError.code === 'PROPERTIES_NOT_ALLOWED'
        ? { code: permissionError.code, message: permissionError.message, fields: permissionError.fields }
        : { code: permissionError.code, message: permissionError.message };
      return { result: null, errors: Object.freeze([error]) };
    }
    return {
      result: null,
      errors: Object.freeze([{ code: 'VALIDATION_ERROR', message: 'no se pudo validar el permiso', cause }]),
    };
  }
}
