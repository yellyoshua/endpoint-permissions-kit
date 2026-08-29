export type PermissionRole = 'admin' | 'user' | 'guest' | string;

export interface PermissionRule {
  action: string;
  resource: string;
  role?: PermissionRole;
  condition?: (context?: Record<string, unknown>) => boolean;
}

export interface PermissionOptions {
  strict?: boolean;
  defaultAllow?: boolean;
}
