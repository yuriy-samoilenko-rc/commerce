import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export interface RequestContext {
  req: Request;
  /** Field-level "before → after" collected by services during this request. */
  changes: Record<string, FieldChange>;
}

/**
 * Per-request storage that follows the request through every async call, so a service
 * deep down can add to the request's audit entry without passing the request around.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  requestContext.run({ req, changes: {} }, next);
}
