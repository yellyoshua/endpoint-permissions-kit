import type { ComponentType } from 'react';
import type { Method, Role, UserPermissionMap } from 'endpoint-permissions-kit';

export interface ScreenPermission {
  readonly action: string;
  readonly name: string;
  readonly methods: readonly Method[];
}

export interface Screen {
  readonly path: string;
  readonly title: string;
  readonly permission: ScreenPermission;
  readonly Component: ComponentType;
}

export interface VisibleScreen {
  readonly screen: Screen;
  readonly methods: readonly Method[];
}

export function permissionIdFor(role: Role, permission: ScreenPermission): `${Role}::${string}::${string}` {
  return `${role}::${permission.action}::${permission.name}`;
}

export function allowedMethods(role: Role, access: UserPermissionMap, permission: ScreenPermission): readonly Method[] {
  const methodAccess = access[permissionIdFor(role, permission)];
  if (methodAccess === undefined) return [];
  return permission.methods.filter((method) => methodAccess[method]);
}

export function visibleScreens(screens: readonly Screen[], role: Role, access: UserPermissionMap): readonly VisibleScreen[] {
  const visible: VisibleScreen[] = [];
  for (const screen of screens) {
    const methods = allowedMethods(role, access, screen.permission);
    if (methods.length > 0) visible.push({ screen, methods });
  }
  return visible;
}

export function domainOf(screen: Screen): string {
  const [, domain] = screen.permission.action.split('.');
  return domain ?? screen.permission.action;
}
