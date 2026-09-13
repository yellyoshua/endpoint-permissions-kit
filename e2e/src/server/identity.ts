import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from 'endpoint-permissions-kit';

export interface Identity {
  readonly id: string;
  readonly role: Role;
  readonly permissions: readonly string[];
}

export interface IdentitySource {
  findUser(id: string): Identity | undefined;
  anonymous?: Identity;
}

declare global {
  namespace Express {
    interface Locals {
      identity: Identity;
    }
  }
}

export const USER_HEADER = 'x-user-id';
export const UNKNOWN_USER_CODE = 'UNKNOWN_USER';

function rejectUnknownUser(res: Response): void {
  res.status(401).json({ error: { code: UNKNOWN_USER_CODE } });
}

export function createIdentityMiddleware(source: IdentitySource): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.header(USER_HEADER);
    if (userId === undefined) {
      if (source.anonymous === undefined) {
        rejectUnknownUser(res);
        return;
      }
      res.locals.identity = source.anonymous;
      next();
      return;
    }
    const user = source.findUser(userId);
    if (user === undefined) {
      rejectUnknownUser(res);
      return;
    }
    res.locals.identity = user;
    next();
  };
}
