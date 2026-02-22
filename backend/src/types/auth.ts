export interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    user?: UserSession;
    /** ADO OAuth access token (present for corporate/AAD-backed accounts) */
    adoAccessToken?: string;
    /** ADO OAuth refresh token */
    adoRefreshToken?: string;
    /** Unix timestamp (seconds) when adoAccessToken expires */
    adoTokenExpiresAt?: number;
  }
}
