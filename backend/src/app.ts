import express, { Application } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import roomsRouter from './routes/rooms';
import aiRouter from './routes/ai';
import { User } from './db/schema';
import type { UserSession } from './types/auth';
import './types/auth'; // register SessionData augmentation

export function createApp(): Application {
  const app = express();

  // Trust the nginx reverse-proxy so req.protocol reflects X-Forwarded-Proto.
  // This is required for secure cookies to work correctly:
  // - HTTP (local/Docker without HTTPS) → secure: false
  // - HTTPS (ngrok / production TLS)    → secure: true
  app.set('trust proxy', 1);

  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: frontendUrls.length === 1 ? frontendUrls[0] : frontendUrls,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // Use secure cookies only when the public-facing URL is HTTPS.
        // This prevents the browser from dropping the session cookie when
        // nginx serves plain HTTP (Docker without TLS / local dev).
        secure: frontendUrls.some(u => u.startsWith('https://')),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  // ── Passport local strategy ────────────────────────────────────────────────
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email: email.toLowerCase() } });
        if (!user) return done(null, false, { message: 'Invalid email or password' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return done(null, false, { message: 'Invalid email or password' });
        const session: UserSession = { id: user.id, displayName: user.display_name, email: user.email };
        return done(null, session);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as UserSession).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findByPk(id);
      if (!user) return done(null, false);
      const session: UserSession = { id: user.id, displayName: user.display_name, email: user.email };
      done(null, session);
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/ai', aiRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
