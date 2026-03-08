import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { User } from '../db/schema';
import type { UserSession } from '../types/auth';
import { childLogger } from '../utils/logger';

const log = childLogger('auth');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

function setAuthCookie(res: Response, payload: UserSession): void {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const isSecure = (process.env.FRONTEND_URL ?? '').split(',').some(u => u.trim().startsWith('https://'));
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
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
    log.error({ err }, 'register error');
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
    log.error({ err }, 'login error');
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
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
