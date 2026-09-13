import type { ErrorBody } from '../server/errors';
import { USER_HEADER } from '../server/identity';

export type ApiResult<Data> =
  | { readonly ok: true; readonly status: number; readonly data: Data }
  | { readonly ok: false; readonly status: number; readonly error: ErrorBody['error'] };

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequest {
  readonly project: string;
  readonly userId: string | undefined;
  readonly path: string;
  readonly method?: ApiMethod;
  readonly body?: unknown;
}

export async function apiFetch<Data>(request: ApiRequest): Promise<ApiResult<Data>> {
  const headers = new Headers();
  if (request.userId !== undefined) headers.set(USER_HEADER, request.userId);
  if (request.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`/api/${request.project}${request.path}`, {
    method: request.method ?? 'GET',
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  if (response.status === 204) return { ok: true, status: response.status, data: undefined as Data };
  const payload = (await response.json()) as Data | ErrorBody;
  if (!response.ok) return { ok: false, status: response.status, error: (payload as ErrorBody).error };
  return { ok: true, status: response.status, data: payload as Data };
}
