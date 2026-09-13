import type { Request, Response } from 'express';
import type { Context } from 'endpoint-permissions-kit';
import type { Identity } from './identity';

export type RequestContext = Context & {
  readonly user: Identity | null;
  readonly path: string;
  readonly permissions: readonly string[];
  readonly params: Readonly<Record<string, string>>;
};

declare global {
  namespace Express {
    interface Locals {
      sessionUser: Identity | null;
    }
  }
}

function singleValueParams(params: Request['params']): Readonly<Record<string, string>> {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return Object.fromEntries(entries);
}

export function buildRequestContext(req: Request, res: Response): RequestContext {
  return {
    user: res.locals.sessionUser,
    path: req.baseUrl + req.path,
    permissions: res.locals.identity.permissions,
    params: singleValueParams(req.params),
  };
}

export function readRequestContext(context: Context | undefined): RequestContext | undefined {
  if (context === undefined || typeof context.path !== 'string' || typeof context.params !== 'object' || context.params === null) return undefined;
  return context as RequestContext;
}

export function resourceIdOf(context: Context | undefined): string | undefined {
  return readRequestContext(context)?.params.id;
}

export function sessionUserIdOf(context: Context | undefined): string | undefined {
  return readRequestContext(context)?.user?.id;
}
