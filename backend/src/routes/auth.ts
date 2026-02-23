import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User } from '../db/schema';
import type { UserSession } from '../types/auth';

const router = Router();

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

    req.session.user = sessionUser;
    req.session.save((err) => {
      if (err) {
        console.error('[auth] session save error on /register:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      return res.status(201).json(sessionUser);
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    'local',
    (err: unknown, user: UserSession | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message ?? 'Invalid email or password' });
      }

      req.session.user = user;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[auth] session save error on /login:', saveErr);
          return res.status(500).json({ error: 'Session error' });
        }
        return res.json(user);
      });
    },
  )(req, res, next);
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[auth] session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

export default router;
