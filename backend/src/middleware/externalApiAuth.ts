import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

const API_KEY_HEADER = 'x-api-key';

/**
 * Hashes a string with SHA-256. Used so we can compare secrets of any length
 * with a fixed-size buffer via timingSafeEqual (avoids length-based timing
 * side-channels and the "different length" throw from timingSafeEqual).
 */
function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Gates access to public/headless endpoints using a single shared secret
 * configured via the EXTERNAL_API_SECRET environment variable, passed by
 * the caller in the `X-Api-Key` request header.
 *
 * Fails closed: if the server has no EXTERNAL_API_SECRET configured, every
 * request is rejected (503) rather than silently allowing access.
 *
 * Usage: router.post('/some-public-route', requireExternalApiKey, handler);
 */
export default function requireExternalApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredSecret = process.env.EXTERNAL_API_SECRET;
  if (!configuredSecret) {
    res.status(503).json({ error: 'External API is not configured on this server' });
    return;
  }

  const provided = req.header(API_KEY_HEADER);
  if (!provided) {
    res.status(401).json({ error: `Missing ${API_KEY_HEADER} header` });
    return;
  }

  const providedHash = sha256(provided);
  const expectedHash = sha256(configuredSecret);

  if (!timingSafeEqual(providedHash, expectedHash)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
