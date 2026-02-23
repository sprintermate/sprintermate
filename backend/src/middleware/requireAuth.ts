import { Request, Response, NextFunction } from 'express';

/**
 * Rejects unauthenticated requests with 401.
 * Apply to any route that requires a signed-in user.
 *
 * Usage: router.get('/protected', requireAuth, handler);
 */
export default function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
