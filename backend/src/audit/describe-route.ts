import type { Request } from 'express';

const VERB_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * Turns a route into a readable action:
 *   PATCH /admin/products/:id          → products.update
 *   POST  /admin/orders/:id/confirm    → orders.confirm
 *   POST  /stock/adjustments           → stock.adjustments.create
 */
export function describeRoute(req: Request) {
  const path: string = req.route?.path ?? req.path;
  const segments = path.split('/').filter((s) => s && s !== 'admin');
  const firstParam = segments.findIndex((s) => s.startsWith(':'));
  const verb = VERB_BY_METHOD[req.method] ?? req.method.toLowerCase();

  if (firstParam === -1) {
    const entityType = segments.join('.');
    return { path, entityType, action: `${entityType}.${verb}` };
  }
  const entityType = segments.slice(0, firstParam).join('.');
  const rest = segments.slice(firstParam + 1).filter((s) => !s.startsWith(':'));
  return {
    path,
    entityType,
    action: `${entityType}.${rest.length ? rest.join('.') : verb}`,
  };
}
