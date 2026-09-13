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

function describeHookFailure(reason: unknown): string {
  try {
    return reason instanceof Error ? reason.message : String(reason);
  } catch {
    return 'el hook lanzó un valor que no se puede describir';
  }
}

export function validate(input: FindInput): Promise<ValidateResult<FindResult>>;
export function validate<RequestData extends Data>(input: WriteInput<RequestData>): Promise<ValidateResult<RequestData>>;
export async function validate(input: ValidateInput): Promise<ValidateResult<FindResult | Data>> {
  try {
    const request = validateRequest(input, getOrCreateState());
    const { registeredModule, nameEntry, permission, result } = request;
    const { method, role } = permission;

    const hookGroups = [
      registeredModule.hooks.get(method),
      nameEntry.hooks.get(GLOBAL_HOOK_OWNER)?.get(method),
      nameEntry.hooks.get(role)?.get(method),
    ];

    const hookCalls: Promise<unknown>[] = [];
    for (const hooks of hookGroups) {
      if (!hooks) continue;
      for (const hook of hooks) hookCalls.push(invokeHook(hook, request));
    }

    const hookResults = await Promise.allSettled(hookCalls);
    const errors: ValidationError[] = [];
    for (const hookResult of hookResults) {
      if (hookResult.status === 'fulfilled') continue;

      const hookCause: unknown = hookResult.reason;
      errors.push({ code: 'HOOK_ERROR', message: describeHookFailure(hookCause), cause: hookCause });
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
