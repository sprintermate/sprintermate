import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requestContextStorage } from '../utils/asyncContext';
import type { JwtPayload } from '../types/auth';

/**
 * Resolves caller identity from req.user (cookie JWT) or the Authorization
 * header, then runs the rest of the request inside an AsyncLocalStorage
 * context so that every logger call downstream automatically includes
 * userId, email, and ip — no manual propagation needed.
 *
 * Mount this *after* `passport.initialize()` and the soft-auth middleware so
 * that `req.user` has already been set when this runs.
 */
export default function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  let userId: string | undefined;
  let email: string | undefined;

  if (req.user) {
    userId = req.user.id;
    email = req.user.email;
  } else {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // Decode only — signature verification is handled by Passport.
        const decoded = jwt.decode(token) as JwtPayload | null;
        if (decoded) {
          userId = decoded.id;
          email = decoded.email;
        }
      } catch {
        // Malformed token — treat as anonymous.
      }
    }
  }

  const ctx = {
    userId: userId ?? 'anonymous',
    email: email ?? 'anonymous',
    ip: req.ip ?? '',
  };

  requestContextStorage.run(ctx, next);
}
