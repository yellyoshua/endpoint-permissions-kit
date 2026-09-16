import constants from './constants';
import errors from './errors';
import type { PermissionId, PkitErrorCode } from './types';

/** The three components a permission identifier is made of, already split. */
export interface PermissionReference {
  readonly role: string;
  readonly action: string;
  readonly name: string;
}

const identifiers = {
  build(role: string, action: string, name: string): PermissionId {
    return `${role}${constants.PERMISSION_ID_SEPARATOR}${action}${constants.PERMISSION_ID_SEPARATOR}${name}` as PermissionId;
  },

  /**
   * Splits `role::module::name` and checks every component.
   * The caller supplies the code and the subject of the message because the same
   * syntax rule is reported as a definition error when registering and as an
   * input error when validating a request.
   */
  parse(value: unknown, code: PkitErrorCode, subject: string): PermissionReference {
    if (typeof value !== 'string') throw invalidIdentifier(value, code, subject);

    const parts = value.split(constants.PERMISSION_ID_SEPARATOR);
    const [role, action, name] = parts;

    if (parts.length !== 3 || role === undefined || action === undefined || name === undefined) {
      throw invalidIdentifier(value, code, subject);
    }

    const isValidRole = isCleanSegment(role) && role !== constants.GLOBAL_HOOK_OWNER;
    const isValidName = isCleanSegment(name) && name !== constants.GLOBAL_HOOK_OWNER;
    const isValidAction = action.split(constants.MODULE_SEPARATOR).every(isCleanSegment);

    if (!isValidRole || !isValidName || !isValidAction) throw invalidIdentifier(value, code, subject);

    return { role, action, name };
  },

  checkRole(role: unknown): void {
    if (typeof role === 'string' && isCleanSegment(role) && role !== constants.GLOBAL_HOOK_OWNER) return;

    throw errors.create('INVALID_DEFINITION',
      `invalid role: "${errors.describe(role)}" (non-empty string, no ":" or surrounding whitespace; "${constants.GLOBAL_HOOK_OWNER}" is reserved for global hooks)`,
    );
  },

  checkModuleSegment(segment: unknown): void {
    if (typeof segment === 'string' && isCleanSegment(segment) && !segment.includes(constants.MODULE_SEPARATOR)) return;

    throw errors.create('INVALID_DEFINITION',
      `invalid module name: "${errors.describe(segment)}" (non-empty string, no dots, no ":" or surrounding whitespace)`,
    );
  },

  checkName(name: unknown): void {
    if (typeof name === 'string' && isCleanSegment(name) && name !== constants.GLOBAL_HOOK_OWNER) return;

    throw errors.create('INVALID_DEFINITION',
      `invalid permission name: "${errors.describe(name)}" (non-empty string, no ":" or surrounding whitespace; "*" is reserved)`,
    );
  },
};

function isCleanSegment(value: string): boolean {
  return value.length > 0 && value.trim() === value && !value.includes(':');
}

function invalidIdentifier(value: unknown, code: PkitErrorCode, subject: string): Error {
  return errors.create(code, `${subject}: "${errors.describe(value)}" (format role::module::name)`);
}

export default identifiers;
