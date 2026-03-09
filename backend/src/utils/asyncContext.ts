import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId: string;
  email: string;
  ip: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
