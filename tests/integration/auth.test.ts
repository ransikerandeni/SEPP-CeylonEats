import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { password, useTestDatabase, write } from './setup';

const ctx = useTestDatabase();
const sessionCookie = (response: request.Response) =>
  (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

describe('sessions', () => {
  test('login issues an HttpOnly, SameSite=Strict session cookie', async () => {
    const response = await write(request.agent(ctx.app), 'post', '/api/auth/login', {
      email: 'customer@ceyloneats.test',
      password,
    });
    expect(response.status).toBe(200);
    expect(response.body.user.password_hash).toBeUndefined();
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  test('a wrong password and an unknown email return identical 401 responses', async () => {
    const wrong = await write(request(ctx.app), 'post', '/api/auth/login', {
      email: 'customer@ceyloneats.test',
      password: 'not-the-right-password',
    });
    const unknown = await write(request(ctx.app), 'post', '/api/auth/login', {
      email: 'nobody@ceyloneats.test',
      password,
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'Email or password is incorrect.' });
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
    expect(unknown.headers['set-cookie']).toBeUndefined();
  });

  test('logging in again replaces the existing session', async () => {
    const agent = request.agent(ctx.app);
    const credentials = { email: 'customer@ceyloneats.test', password };
    const first = await write(agent, 'post', '/api/auth/login', credentials);
    const second = await write(agent, 'post', '/api/auth/login', credentials);
    expect(second.status).toBe(200);
    expect(sessionCookie(second)).not.toBe(sessionCookie(first));
    const stale = await request(ctx.app).get('/api/auth/me').set('Cookie', sessionCookie(first));
    expect(stale.body.user).toBeNull();
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('customer@ceyloneats.test');
  });
});

describe('registration', () => {
  test('registration cannot grant staff roles and logout invalidates the server session', async () => {
    const agent = request.agent(ctx.app);
    const registered = await write(agent, 'post', '/api/auth/register', {
      name: 'New Test User',
      email: 'new-test@example.test',
      password,
      role: 'admin',
    });
    expect(registered.status).toBe(201);
    expect(registered.body.user.role).toBe('customer');
    expect(registered.body.user.password_hash).toBeUndefined();
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('New Test User');
    expect((await agent.get('/api/admin/data')).status).toBe(403);
    const cookies = registered.headers['set-cookie'];
    await write(agent, 'post', '/api/auth/logout', {});
    expect(
      (await request(ctx.app).get('/api/auth/me').set('Cookie', cookies)).body.user,
    ).toBeNull();
  });

  test('a duplicate email in any letter case is refused with a generic 409 and no session', async () => {
    const response = await write(request(ctx.app), 'post', '/api/auth/register', {
      name: 'Duplicate Customer',
      email: 'CUSTOMER@ceyloneats.test',
      password: 'another-private-password-99',
    });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'That email address cannot be registered. Sign in instead.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    const original = await write(request(ctx.app), 'post', '/api/auth/login', {
      email: 'customer@ceyloneats.test',
      password,
    });
    expect(original.status).toBe(200);
    expect(original.body.user.name).toBe('Nethmi Perera');
  });
});

describe('access control', () => {
  test('anonymous writes, customer administration and cross-origin requests are rejected', async () => {
    expect((await write(request(ctx.app), 'post', '/api/reviews', {})).status).toBe(401);
    expect((await ctx.customer.get('/api/admin/data')).status).toBe(403);
    expect((await write(ctx.moderator, 'post', '/api/admin/restaurants', {})).status).toBe(403);
    expect((await ctx.customer.post('/api/reviews').send({})).status).toBe(403);
    expect(
      (
        await ctx.customer
          .post('/api/reviews')
          .set('X-Requested-With', 'CeylonEats')
          .set('Origin', 'https://untrusted.example')
          .send({})
      ).status,
    ).toBe(403);
  });
});
