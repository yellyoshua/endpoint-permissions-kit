import type { Request, RequestHandler, Response } from 'express';
import pkit from 'endpoint-permissions-kit';
import type { NamedPermissionCatalog, PermissionId } from 'endpoint-permissions-kit';
import { authorizeFind, type Guard } from './authorize';
import { validationErrorsToHttp } from './errors';

export type ProjectCatalog = Readonly<Record<PermissionId, NamedPermissionCatalog[PermissionId]>>;

interface CatalogRouteOptions {
  readonly modulePrefix: string;
  readonly guard: Guard;
}

const CATALOG_BY_PREFIX = new Map<string, ProjectCatalog>();

function catalogFor(modulePrefix: string): ProjectCatalog {
  const cached = CATALOG_BY_PREFIX.get(modulePrefix);
  if (cached !== undefined) return cached;
  const entries = Object.entries(pkit.permissions.named).filter(([permissionId]) => {
    const [, action] = permissionId.split('::');
    return action !== undefined && action.startsWith(`${modulePrefix}.`);
  });
  const catalog: ProjectCatalog = Object.freeze(Object.fromEntries(entries));
  CATALOG_BY_PREFIX.set(modulePrefix, catalog);
  return catalog;
}

export function createCatalogHandler(options: CatalogRouteOptions): RequestHandler {
  return async (_req: Request, res: Response) => {
    const authorization = await authorizeFind({ guard: options.guard, identity: res.locals.identity });
    if (!authorization.isAllowed) {
      const http = validationErrorsToHttp(authorization.errors);
      res.status(http.status).json(http.body);
      return;
    }
    res.json(catalogFor(options.modulePrefix));
  };
}
