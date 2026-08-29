export function parseEndpointPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function isAllowedAction(action: string, allowedActions: string[]): boolean {
  return allowedActions.includes('*') || allowedActions.includes(action);
}
