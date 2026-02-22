export interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: UserSession;
  }
}
