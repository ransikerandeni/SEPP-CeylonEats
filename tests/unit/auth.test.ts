import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { query } from '../../server/db';
import {
  hash,
  requireUser,
  roles,
  loadUser,
  setSession,
  clearSession,
  type User,
} from '../../server/auth';

vi.mock('../../server/db', () => ({ query: vi.fn() }));

const mockQuery = vi.mocked(query);
const week = 1000 * 60 * 60 * 24 * 7;
const alice: User = { id: 1, name: 'Alice', email: 'alice@example.com', role: 'customer' };

function fakeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const asReq = (r: object) => r as unknown as Request;
const asRes = (r: ReturnType<typeof fakeRes>) => r as unknown as Response;

beforeEach(() => {
  mockQuery.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('hash', () => {
  it('produces the deterministic 64-character SHA-256 hex digest of the token', () => {
    const digest = hash('token');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash('sha256').update('token').digest('hex'));
    expect(hash('token')).toBe(digest);
    expect(hash('other')).not.toBe(digest);
  });
});

describe('requireUser', () => {
  it('responds 401 when nobody is signed in', () => {
    const res = fakeRes();
    const next = vi.fn();
    requireUser(asReq({}), asRes(res), next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please sign in to continue.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when a user is signed in', () => {
    const res = fakeRes();
    const next = vi.fn();
    requireUser(asReq({ user: alice }), asRes(res), next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('roles', () => {
  it('responds 401 when nobody is signed in', () => {
    const res = fakeRes();
    const next = vi.fn();
    roles('admin')(asReq({}), asRes(res), next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [['admin'], 'customer'],
    [['admin'], 'moderator'],
    [['admin', 'moderator'], 'owner'],
  ] as const)('with allowed roles %j responds 403 to a %s', (allowed, role) => {
    const res = fakeRes();
    const next = vi.fn();
    roles(...allowed)(asReq({ user: { ...alice, role } }), asRes(res), next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'This account does not have access.' });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [['admin'], 'admin'],
    [['admin', 'moderator'], 'moderator'],
    [['admin', 'moderator'], 'admin'],
  ] as const)('with allowed roles %j lets a %s through', (allowed, role) => {
    const res = fakeRes();
    const next = vi.fn();
    roles(...allowed)(asReq({ user: { ...alice, role } }), asRes(res), next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('loadUser', () => {
  it.each([
    ['no cookies', undefined],
    ['no session cookie', {}],
    ['a non-string session', { session: ['a'.repeat(64)] }],
    ['a short token', { session: 'a'.repeat(63) }],
    ['a long token', { session: 'a'.repeat(65) }],
  ])('ignores %s without querying the database', async (_label, cookies) => {
    const req = asReq({ cookies });
    const next = vi.fn();
    await loadUser(req, asRes(fakeRes()), next);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('looks up the session by the hashed token and attaches the user', async () => {
    const token = 'f'.repeat(64);
    mockQuery.mockResolvedValue({ rows: [alice] } as never);
    const req = asReq({ cookies: { session: token } });
    const next = vi.fn();
    await loadUser(req, asRes(fakeRes()), next);
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('s.expires_at>now()');
    expect(params).toEqual([hash(token)]);
    expect(params).not.toContain(token);
    expect(req.user).toEqual(alice);
    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves the request anonymous when the session is unknown or expired', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const req = asReq({ cookies: { session: 'a'.repeat(64) } });
    const next = vi.fn();
    await loadUser(req, asRes(fakeRes()), next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('setSession', () => {
  it('purges expired sessions, stores only the token hash and sets a strict cookie', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = fakeRes();
    await setSession(asRes(res), 42);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0][0]).toBe('DELETE FROM sessions WHERE expires_at<now()');
    const [insertSql, insertParams] = mockQuery.mock.calls[1];
    expect(insertSql).toContain('INSERT INTO sessions');

    expect(res.cookie).toHaveBeenCalledOnce();
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe('session');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(insertParams).toEqual([hash(token), 42]);
    expect(options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: week,
    });
  });

  it('issues a fresh random token each time', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = fakeRes();
    await setSession(asRes(res), 1);
    await setSession(asRes(res), 1);
    expect(res.cookie.mock.calls[0][1]).not.toBe(res.cookie.mock.calls[1][1]);
  });

  it.each([
    ['production', true],
    ['development', false],
    ['test', false],
  ])('marks the cookie secure=%s when NODE_ENV is %s', async (env, secure) => {
    vi.stubEnv('NODE_ENV', env);
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = fakeRes();
    await setSession(asRes(res), 1);
    expect(res.cookie.mock.calls[0][2].secure).toBe(secure);
  });
});

describe('clearSession', () => {
  it('clears the session cookie with the same flags and no maxAge', () => {
    const res = fakeRes();
    clearSession(asRes(res));
    expect(res.clearCookie).toHaveBeenCalledWith('session', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: undefined,
    });
  });

  it('keeps the secure flag in production so the browser matches the cookie', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = fakeRes();
    clearSession(asRes(res));
    expect(res.clearCookie.mock.calls[0][1]).toMatchObject({ secure: true });
  });
});
