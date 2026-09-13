import { randomBytes, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { query } from './db';
export type User = { id: number; name: string; email: string; role: 'customer'|'owner'|'moderator'|'admin' };
declare global { namespace Express { interface Request { user?: User } } }
export const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 1000*60*60*24*7 });
export async function setSession(res: Response, userId: number) {
  const token = randomBytes(32).toString('hex');
  await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hash(token),userId]);
  res.cookie('session',token,options());
}
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token=req.cookies?.session;
  if(typeof token==='string' && token.length===64) req.user=(await query('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)])).rows[0];
  next();
}
export function requireUser(req: Request, res: Response, next: NextFunction) { if(!req.user) return res.status(401).json({error:'Please sign in to continue.'}); next(); }
export function roles(...allowed: string[]) { return (req: Request,res: Response,next: NextFunction) => { if(!req.user) return res.status(401).json({error:'Please sign in to continue.'}); if(!allowed.includes(req.user.role)) return res.status(403).json({error:'This account does not have access.'}); next(); }; }
export function clearSession(res: Response) { res.clearCookie('session',{...options(),maxAge:undefined}); }
