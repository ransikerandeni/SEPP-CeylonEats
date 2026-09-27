import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { query, transaction } from '../../server/db';
import { app } from '../../server/app';

vi.hoisted(() => {
  process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
});
vi.mock('../../server/db', () => ({ query: vi.fn(), transaction: vi.fn(), pool: {} }));

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(transaction);
const origin = 'http://127.0.0.1:5173';
const verified = { 'X-Requested-With': 'CeylonEats' };
const empty = { rows: [], rowCount: 0 } as never;

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue(empty);
  mockTransaction.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('security middleware', () => {
  it('omits x-powered-by and sends helmet headers', async () => {
    const res = await request(app).get('/api/config');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("img-src 'self' https: data:");
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sends rate limit headers on API responses', async () => {
    const res = await request(app).get('/api/config');
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'refuses a %s without the verification header',
    async (method) => {
      const res = await request(app)[method]('/api/auth/logout');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Missing request verification header.' });
      expect(mockQuery).not.toHaveBeenCalled();
    },
  );

  it('refuses a verification header with the wrong value', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(res.status).toBe(403);
  });

  it('refuses a state-changing request from a foreign origin', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set(verified)
      .set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Request origin is not allowed.' });
  });

  it('accepts a verified request from the app origin', async () => {
    const res = await request(app).post('/api/auth/logout').set(verified).set('Origin', origin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^session=;/);
  });

  it('accepts a verified request that sends no Origin header', async () => {
    const res = await request(app).post('/api/auth/logout').set(verified);
    expect(res.status).toBe(200);
  });

  it('allows a GET without the verification header', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Ceylon Eats' });
  });

  it('reports an anonymous visitor without touching the database', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body).toEqual({ user: null });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('routing', () => {
  it('answers an unknown API route with a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'API route not found.' });
  });

  it('reports healthy when the database answers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'postgresql' });
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 404 for a restaurant that does not exist', async () => {
    const res = await request(app).get('/api/restaurants/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Restaurant not found.' });
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('restaurant_stats'), [999]);
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'rejects the restaurant id %j with a 400 before querying',
    async (value) => {
      const res = await request(app).get(`/api/restaurants/${value}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/^Input: /);
      expect(mockQuery).not.toHaveBeenCalled();
    },
  );

  it('coerces a hexadecimal restaurant id to a number', async () => {
    const res = await request(app).get('/api/restaurants/0x10');
    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [16]);
  });

  it('rejects an invalid explore filter without hitting the database', async () => {
    const res = await request(app).get('/api/explore?spice=9');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^spice: /);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('binds explore filters as parameters and escapes LIKE wildcards', async () => {
    const res = await request(app).get('/api/explore?city=Kandy&q=50%25_off');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurants: [], dishes: [] });
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0][1]).toEqual(['Kandy', '%50\\%\\_off%']);
  });
});

describe('central error handler', () => {
  it('turns a validation failure into a 400 naming the field', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(verified)
      .send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^email: /);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('joins several validation issues with semicolons', async () => {
    const res = await request(app).post('/api/auth/login').set(verified).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email: ');
    expect(res.body.error).toContain('; password: ');
  });

  it.each([
    ['23505', 409, 'An entry with those details already exists.'],
    ['23503', 400, 'Check the related entry and required field values.'],
    ['23514', 400, 'Check the related entry and required field values.'],
  ])('maps PostgreSQL error %s to %i', async (code, status, error) => {
    mockQuery.mockRejectedValue(Object.assign(new Error('db'), { code }));
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
  });

  it('passes through a client error status and message', async () => {
    mockQuery.mockRejectedValue(Object.assign(new Error('Gone away.'), { status: 404 }));
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Gone away.' });
  });

  it.each([
    ['a plain error', new Error('connection refused at 10.0.0.5')],
    ['a 5xx status error', Object.assign(new Error('secret detail'), { status: 503 })],
  ])('hides %s behind a generic 500', async (_label, failure) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValue(failure);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(log).toHaveBeenCalledWith(failure);
  });

  it('returns 404 from a transaction that finds no posting to moderate', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 9, name: 'Mo', email: 'mo@example.com', role: 'moderator' }],
    } as never);
    mockTransaction.mockImplementation(async (fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [] }) } as never),
    );
    const res = await request(app)
      .patch('/api/admin/postings/5')
      .set(verified)
      .set('Cookie', `session=${'a'.repeat(64)}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Posting not found.' });
  });

  it('rejects malformed JSON with a 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(verified)
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('rejects a body larger than 32kb with a 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(verified)
      .send({ email: 'a@b.co', password: 'x'.repeat(40_000) });
    expect(res.status).toBe(413);
  });
});
