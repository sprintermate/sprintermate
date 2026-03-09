import { Request, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const aiRateLimit: RequestHandler =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request): string => {
          return (req.user as { id?: string } | undefined)?.id ?? ipKeyGenerator(req.ip ?? '');
        },
        message: { error: 'Too many AI requests. Please wait before trying again.' },
      })
    : (_req, _res, next) => next();

export default aiRateLimit;
