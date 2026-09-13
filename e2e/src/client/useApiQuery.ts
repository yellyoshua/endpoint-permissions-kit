import { useEffect, useState } from 'react';
import type { ApiResult } from './api';

export type QueryState<Data> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly code: string; readonly message?: string }
  | { readonly status: 'ready'; readonly data: Data };

export interface ApiQuery<Data> {
  readonly state: QueryState<Data>;
  readonly reload: () => void;
}

export default function useApiQuery<Data>(load: () => Promise<ApiResult<Data>>, dependencies: readonly unknown[]): ApiQuery<Data> {
  const [state, setState] = useState<QueryState<Data>>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let isCurrent = true;
    setState({ status: 'loading' });
    load().then((result) => {
      if (!isCurrent) return;
      if (result.ok) {
        setState({ status: 'ready', data: result.data });
        return;
      }
      setState({ status: 'error', code: result.error.code, message: result.error.message });
    }).catch((cause: unknown) => {
      if (!isCurrent) return;
      setState({ status: 'error', code: 'NETWORK', message: cause instanceof Error ? cause.message : String(cause) });
    });
    return () => {
      isCurrent = false;
    };
  }, [...dependencies, version]);
  return { state, reload: () => setVersion((current) => current + 1) };
}
