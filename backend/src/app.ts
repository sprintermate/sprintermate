import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import roomsRouter from './routes/rooms';
import aiRouter from './routes/ai';
import metricsRouter from './routes/metrics';
import retroRouter from './routes/retro';
import { User } from './db/schema';
import type { JwtPayload } from './types/auth';
import './types/auth'; // register Express.User augmentation

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
  app.use(cookieParser());

  // ── JWT Strategy ────────────────────────────────────────────────────────────
  const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';

  const cookieExtractor = (req: Request): string | null => req?.cookies?.token ?? null;

  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: cookieExtractor,
        secretOrKey: JWT_SECRET,
      },
      async (payload: JwtPayload, done) => {
        try {
          const user = await User.findByPk(payload.id);
          if (!user) return done(null, false);
          const u = user.get({ plain: true });
          return done(null, { id: u.id, displayName: u.display_name, email: u.email });
        } catch (err) {
          return done(err, false);
        }
      },
    ),
  );

  app.use(passport.initialize());

  // Soft JWT check — populates req.user if token is valid, continues if not.
  // This allows guest-accessible routes to work without requiring authentication.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    passport.authenticate(
      'jwt',
      { session: false },
      (_err: unknown, user: Express.User | false) => {
        if (user) req.user = user;
        next();
      },
    )(req, _res, next);
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/metrics', metricsRouter);
  app.use('/api/retro', retroRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
