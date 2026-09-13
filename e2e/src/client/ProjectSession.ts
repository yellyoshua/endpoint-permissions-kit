import { createContext } from 'react';
import type { Method } from 'endpoint-permissions-kit';
import type { MeResponse } from '../server/meRoute';
import { apiFetch, type ApiMethod, type ApiResult } from './api';

export interface ProjectSession {
  readonly project: string;
  readonly userId: string | undefined;
  readonly me: MeResponse;
  readonly can: (action: string, name: string, method: Method) => boolean;
  readonly request: <Data>(path: string, method?: ApiMethod, body?: unknown) => Promise<ApiResult<Data>>;
}

export const ProjectSessionContext = createContext<ProjectSession | undefined>(undefined);

export function createProjectSession(project: string, userId: string | undefined, me: MeResponse): ProjectSession {
  return {
    project,
    userId,
    me,
    can: (action, name, method) => me.access[`${me.role}::${action}::${name}`]?.[method] === true,
    request: (path, method, body) => apiFetch({ project, userId, path, method, body }),
  };
}
