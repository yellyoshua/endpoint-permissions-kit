import type { Data } from 'endpoint-permissions-kit';

export function asData(value: unknown): Data | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Data;
}

export function parseSelect(value: unknown): readonly string[] | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.split(',');
}
