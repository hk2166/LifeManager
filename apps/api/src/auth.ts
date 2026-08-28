import type express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export const signToken = (userId: string) => jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '30d' });
export const verifyToken = (token: string) => (jwt.verify(token, JWT_SECRET) as { uid: string }).uid;

export interface AuthedRequest extends express.Request {
  userId: string;
}

// Gate for every /api data route: requires a valid Bearer token, sets req.userId.
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: string };
    (req as AuthedRequest).userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

// Wrap an async handler that needs req.userId; funnels errors to a 500 like http.h.
export const authed =
  (fn: (req: AuthedRequest, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) =>
    void fn(req as AuthedRequest, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) });
    });
