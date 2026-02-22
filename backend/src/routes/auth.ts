import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { UserSession } from '../types/auth';

const router = Router();

// Read at call time, not at module load time, to avoid the dotenv ordering issue
// (TypeScript hoists all import→require() calls above dotenv.config()).
function cfg() {
  return {
    clientId:     process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    redirectUri:  process.env.MICROSOFT_REDIRECT_URI!,
    frontendUrl:  process.env.FRONTEND_URL ?? 'http://localhost:3000',
    // 'common' routes each user to their own tenant automatically,
    // supporting both personal Microsoft accounts and corporate Azure AD accounts.
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl:     'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  };
}

const SCOPES = 'openid profile email offline_access';

// GET /api/auth/login
// Generates a CSRF state token, saves it to the session, then redirects to Microsoft.
router.get('/login', (req: Request, res: Response) => {
  const { clientId, redirectUri, authorizeUrl, frontendUrl } = cfg();
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  req.session.save((err) => {
    if (err) {
      console.error('[auth] session save error on /login:', err);
      return res.status(500).json({ error: 'Session error' });
    }

    const params = new URLSearchParams({
      client_id:     clientId,
      response_type: 'code',
      redirect_uri:  redirectUri,
      scope:         SCOPES,
      state,
      response_mode: 'query',
    });

    res.redirect(`${authorizeUrl}?${params.toString()}`);
  });
});

// GET /api/auth/callback
// Microsoft redirects here after sign-in.
router.get('/callback', async (req: Request, res: Response) => {
  const { clientId, clientSecret, redirectUri, tokenUrl, frontendUrl } = cfg();
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    console.error('[auth] Microsoft returned error:', error, error_description);
    return res.redirect(`${frontendUrl}/en/login?error=access_denied`);
  }

  const expectedState = req.session.oauthState;
  if (!state || !expectedState || state !== expectedState) {
    console.warn('[auth] State mismatch — possible CSRF attack');
    return res.redirect(`${frontendUrl}/en/login?error=state_mismatch`);
  }

  delete req.session.oauthState;

  // Exchange authorization code for tokens
  // The id_token (JWT) returned here contains the user's profile — no Graph call needed.
  let user: UserSession;
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         SCOPES,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('[auth] Token exchange failed:', tokenRes.status, body);
      return res.redirect(`${frontendUrl}/en/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as {
      id_token: string;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    // Parse the ID token payload (base64url-encoded middle segment).
    // We trust this token because it arrived directly from Microsoft's token
    // endpoint over TLS — no signature verification needed for our use case.
    const payloadB64 = tokenData.id_token.split('.')[1];
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as {
      oid?: string;
      sub: string;
      name?: string;
      email?: string;
      preferred_username?: string;
    };

    user = {
      id:          payload.oid ?? payload.sub,
      displayName: payload.name ?? payload.preferred_username ?? 'User',
      email:       payload.email ?? payload.preferred_username ?? '',
    };

    // Store the ADO access token in the session when present.
    // This is available for AAD-backed (corporate) accounts; personal MSA
    // accounts may not receive a usable ADO token and should use a PAT instead.
    if (tokenData.access_token) {
      req.session.adoAccessToken    = tokenData.access_token;
      req.session.adoRefreshToken   = tokenData.refresh_token;
      req.session.adoTokenExpiresAt = tokenData.expires_in
        ? Math.floor(Date.now() / 1000) + tokenData.expires_in
        : undefined;
    }
  } catch (err) {
    console.error('[auth] Token exchange / ID token parse error:', err);
    return res.redirect(`${frontendUrl}/en/login?error=token_exchange_failed`);
  }

  // Persist user in session and redirect to dashboard
  req.session.user = user;
  req.session.save((err) => {
    if (err) {
      console.error('[auth] session save error on /callback:', err);
      return res.redirect(`${frontendUrl}/en/login?error=session_error`);
    }
    res.redirect(`${frontendUrl}/en/dashboard`);
  });
});

// GET /api/auth/admin-consent?tenant_id=<corporate-tenant-id>
// Redirects a corporate tenant admin to the admin consent page.
// After the admin approves, all users in their org can sign in without being prompted.
router.get('/admin-consent', (req: Request, res: Response) => {
  const { clientId, redirectUri } = cfg();
  const tenantId = req.query.tenant_id as string | undefined;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant_id query parameter' });
  }

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
  });

  res.redirect(
    `https://login.microsoftonline.com/${tenantId}/adminconsent?${params.toString()}`,
  );
});

// GET /api/auth/me
// Returns the authenticated user or 401.
router.get('/me', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

// POST /api/auth/logout
// Destroys the session and redirects to login.
router.post('/logout', (req: Request, res: Response) => {
  const { frontendUrl } = cfg();
  req.session.destroy((err) => {
    if (err) {
      console.error('[auth] session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.redirect(`${frontendUrl}/en/login`);
  });
});

export default router;
