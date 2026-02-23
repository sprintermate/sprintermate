export interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

export interface JwtPayload {
  id: string;
  displayName: string;
  email: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface User extends UserSession {}
  }
}
