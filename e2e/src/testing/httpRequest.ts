import { USER_HEADER } from '../server/identity';

export interface HttpRequestOptions {
  readonly baseUrl: string;
  readonly path: string;
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly userId?: string;
  readonly body?: unknown;
}

export interface HttpResponse<Body> {
  readonly status: number;
  readonly body: Body;
}

export async function httpRequest<Body = unknown>(options: HttpRequestOptions): Promise<HttpResponse<Body>> {
  const headers = new Headers();
  if (options.userId !== undefined) headers.set(USER_HEADER, options.userId);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${options.baseUrl}${options.path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return { status: response.status, body: undefined as Body };
  const body = (await response.json()) as Body;
  return { status: response.status, body };
}
