import constants from './constants';
import errors from './errors';

export interface PermissionReference {
  readonly id: string;
  readonly role: string;
  readonly module: string;
  readonly name: string;
}

const identifiers = {
  build(role: string, modulePath: string, name: string): string {
    return `${role}${constants.PERMISSION_ID_SEPARATOR}${modulePath}${constants.PERMISSION_ID_SEPARATOR}${name}`;
  },

  prefix(role: string, modulePath: string): string {
    return `${role}${constants.PERMISSION_ID_SEPARATOR}${modulePath}${constants.PERMISSION_ID_SEPARATOR}`;
  },

  joinModule(segments: readonly string[]): string {
    return segments.join(constants.MODULE_SEPARATOR);
  },

  parse(value: unknown): PermissionReference | null {
    if (typeof value !== 'string') return null;

    const parts = value.split(constants.PERMISSION_ID_SEPARATOR);

    if (parts.length !== 3) return null;

    const [role, modulePath, name] = parts as [string, string, string];

    if (!isValidLabel(role) || !isValidLabel(name) || !isValidModulePath(modulePath)) return null;

    return Object.freeze({ id: value, role, module: modulePath, name });
  },

  checkSegment(segment: unknown): string {
    if (typeof segment !== 'string' || !isValidSegment(segment)) {
      throw errors.create('INVALID_DEFINITION', `Invalid module segment: ${errors.describe(segment)}`);
    }

    return segment;
  },

  checkName(name: unknown): string {
    if (typeof name !== 'string' || !isValidLabel(name)) {
      throw errors.create('INVALID_DEFINITION', `Invalid permission name: ${errors.describe(name)}`);
    }

    return name;
  },

  checkRoleLabel(role: unknown): string {
    if (typeof role !== 'string' || !isValidLabel(role)) {
      throw errors.create('INVALID_DEFINITION', `Invalid role: ${errors.describe(role)}`);
    }

    return role;
  },
};

export default identifiers;

function isValidLabel(label: string): boolean {
  return label.length > 0 && label !== constants.GLOBAL_HOOK_MARKER && !label.includes(':') && label.trim() === label;
}

function isValidSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes(constants.MODULE_SEPARATOR) && !segment.includes(':') && segment.trim() === segment;
}

function isValidModulePath(modulePath: string): boolean {
  return modulePath.length > 0 && modulePath.split(constants.MODULE_SEPARATOR).every(isValidSegment);
}
