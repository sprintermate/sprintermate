import { Router, Request, Response, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomInt } from 'crypto';
import { User, PasswordResetCode } from '../db/schema';
import type { UserSession } from '../types/auth';
import { childLogger } from '../utils/logger';
import { sendPasswordResetEmail } from '../services/emailService';
import { Op } from 'sequelize';

const log = childLogger('auth');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

function getCookieOptions(): CookieOptions {
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN;
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

function setAuthCookie(res: Response, payload: UserSession): void {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.cookie('token', token, {
    ...getCookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password and displayName are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ where: { email: emailLower } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      id: randomUUID(),
      email: emailLower,
      password_hash,
      display_name: displayName.trim(),
      created_at: new Date().toISOString(),
    });

    const sessionUser: UserSession = {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
    };

    setAuthCookie(res, sessionUser);
    return res.status(201).json(sessionUser);
  } catch (err) {
    log.error('register error', { err });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionUser: UserSession = {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
    };

    setAuthCookie(res, sessionUser);
    return res.json(sessionUser);
  } catch (err) {
    log.error('login error', { err });
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', getCookieOptions());
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const user = await User.findOne({ where: { email: emailLower } });

    // Always return 200 to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, a reset code has been sent.' });
    }

    // Invalidate any previous unused codes for this email
    await PasswordResetCode.update(
      { used: true },
      { where: { email: emailLower, used: false } },
    );

    // Generate 6-digit code
    const code = String(randomInt(100000, 999999));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 180 * 1000); // 180 seconds

    await PasswordResetCode.create({
      id: randomUUID(),
      email: emailLower,
      code,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      used: false,
      created_at: now.toISOString(),
    });

    // Send email (fire-and-forget style, but log errors)
    await sendPasswordResetEmail(emailLower, code);

    return res.json({ message: 'If the email exists, a reset code has been sent.' });
  } catch (err) {
    log.error('forgot-password error', { err });
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'email, code, and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Find the latest unused, non-expired code for this email
    const resetCode = await PasswordResetCode.findOne({
      where: {
        email: emailLower,
        used: false,
        expires_at: { [Op.gt]: new Date().toISOString() },
      },
      order: [['created_at', 'DESC']],
    });

    if (!resetCode) {
      return res.status(400).json({ error: 'expired_or_invalid' });
    }

    const rc = resetCode.get({ plain: true });

    // Check attempt count
    if (rc.attempts >= 5) {
      await PasswordResetCode.update({ used: true }, { where: { id: rc.id } });
      return res.status(400).json({ error: 'too_many_attempts' });
    }

    // Increment attempts
    await PasswordResetCode.update(
      { attempts: rc.attempts + 1 },
      { where: { id: rc.id } },
    );

    // Verify code
    if (rc.code !== code.trim()) {
      return res.status(400).json({ error: 'invalid_code' });
    }

    // Code is correct — update password and mark code as used
    const user = await User.findOne({ where: { email: emailLower } });
    if (!user) {
      return res.status(400).json({ error: 'expired_or_invalid' });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await User.update({ password_hash }, { where: { id: user.id } });
    await PasswordResetCode.update({ used: true }, { where: { id: rc.id } });

    log.info('password reset successful', { email: emailLower });
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    log.error('reset-password error', { err });
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
