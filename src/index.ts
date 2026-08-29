export * from './types/index.js';
export * from './permissions/index.js';
export * from './utils/index.js';

/**
 * Creates a new instance of PermissionManager.
 */
import { PermissionManager } from './permissions/index.js';
import type { PermissionOptions } from './types/index.js';

export function createPermissions(options?: PermissionOptions): PermissionManager {
  return new PermissionManager(options);
}
