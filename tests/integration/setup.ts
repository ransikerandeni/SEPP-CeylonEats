import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import type { Express } from 'express';

export const password = 'Test-only-private-password-4721';

export type Agent = ReturnType<typeof request.agent>;

/** Sends a state-changing request with the header the API requires for CSRF protection. */
export const write = (
  agent: Agent | ReturnType<typeof request>,
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  body: unknown,
) => (agent as any)[method](url).set('X-Requested-With', 'CeylonEats').send(body);

export type TestContext = {
  app: Express;
  pool: pg.Pool;
  customer: Agent;
  moderator: Agent;
  admin: Agent;
  owner: Agent;
  restaurantId: number;
  dishId: number;
  signUp: (label: string) => Promise<Agent>;
};

/**
 * Gives the calling test file its own freshly seeded, uniquely named schema and
 * signed-in agents for each seeded role, then drops only that schema afterward.
 * Vitest isolates modules per file, so each file also gets its own app and pool.
 */
export function useTestDatabase(): TestContext {
  const schema = `test_ceylon_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const ctx = {} as TestContext;
  let signUps = 0;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    // The app reads DATABASE_URL when db.ts is first imported.
    process.env.DATABASE_URL = url.toString();
    ({ app: ctx.app } = await import('../../server/app'));
    ({ pool: ctx.pool } = await import('../../server/db'));
    const { seed } = await import('../../server/seed');
    await seed(password);

    for (const role of ['customer', 'moderator', 'admin', 'owner'] as const) {
      const agent = request.agent(ctx.app);
      const response = await write(agent, 'post', '/api/auth/login', {
        email: `${role}@ceyloneats.test`,
        password,
      });
      assert.equal(response.status, 200);
      ctx[role] = agent;
    }
    const explore = (await request(ctx.app).get('/api/explore')).body;
    ctx.restaurantId = explore.restaurants[0].id;
    ctx.dishId = explore.dishes.find((d: any) => d.restaurant_id === ctx.restaurantId).id;
    ctx.signUp = async (label: string) => {
      const agent = request.agent(ctx.app);
      const response = await write(agent, 'post', '/api/auth/register', {
        name: `Test Reviewer ${label}`,
        email: `${label}-${++signUps}@example.test`,
        password,
      });
      assert.equal(response.status, 201);
      return agent;
    };
  });

  afterAll(async () => {
    await ctx.pool?.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  });

  return ctx;
}
