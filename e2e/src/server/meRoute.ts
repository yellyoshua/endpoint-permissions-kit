import type { Request, Response } from 'express';
import pkit from 'endpoint-permissions-kit';
import type { Role, UserPermissionMap } from 'endpoint-permissions-kit';
import { thrownErrorToHttp } from './errors';

export interface MeResponse {
  readonly user: string;
  readonly role: Role;
  readonly access: UserPermissionMap;
}

export default function meHandler(_req: Request, res: Response): void {
  const { identity } = res.locals;
  try {
    const access = pkit.permissions.forUser({ role: identity.role, permissions: identity.permissions });
    const body: MeResponse = { user: identity.id, role: identity.role, access };
    res.json(body);
  } catch (error) {
    const http = thrownErrorToHttp(error);
    res.status(http.status).json(http.body);
  }
}
