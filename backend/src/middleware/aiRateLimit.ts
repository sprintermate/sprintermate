import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return (req.user as { id?: string } | undefined)?.id ?? ipKeyGenerator(req.ip ?? '');
  },
  message: { error: 'Too many AI requests. Please wait before trying again.' },
});

export default aiRateLimit;
