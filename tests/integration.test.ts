import 'dotenv/config';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import type { Express } from 'express';

// A fresh, randomly named schema keeps all test writes away from application data.
const schema = `test_ceylon_${process.pid}_${Date.now()}`;
const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const testUrl = new URL(process.env.DATABASE_URL!);
testUrl.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = testUrl.toString();
let app: Express;
let pool: pg.Pool;
let customer: any;
let moderator: any;
let admin: any;
let owner: any;
const password = 'Test-only-private-password-4721';
const write = (agent: any, method: string, url: string, body: unknown) =>
  agent[method](url).set('X-Requested-With', 'CeylonEats').send(body);
let restaurantId: number, dishId: number;
let signUps = 0;
// Registers a throwaway customer and returns an agent already holding its session.
async function signUp(label: string) {
  const agent = request.agent(app);
  const response = await write(agent, 'post', '/api/auth/register', {
    name: `Test Reviewer ${label}`,
    email: `${label}-${++signUps}@example.test`,
    password,
  });
  assert.equal(response.status, 201);
  return agent;
}
before(async () => {
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  ({ app } = await import('../server/app'));
  ({ pool } = await import('../server/db'));
  const { seed } = await import('../server/seed');
  await seed(password);
  customer = request.agent(app);
  moderator = request.agent(app);
  admin = request.agent(app);
  owner = request.agent(app);
  for (const [agent, email] of [
    [customer, 'customer'],
    [moderator, 'moderator'],
    [admin, 'admin'],
    [owner, 'owner'],
  ]) {
    const response = await write(agent, 'post', '/api/auth/login', {
      email: `${email}@ceyloneats.test`,
      password,
    });
    assert.equal(response.status, 200);
    assert.ok(response.headers['set-cookie'][0].includes('HttpOnly'));
    assert.ok(response.headers['set-cookie'][0].includes('SameSite=Strict'));
  }
  const detail = await request(app).get('/api/explore');
  restaurantId = detail.body.restaurants[0].id;
  dishId = detail.body.dishes.find((d: any) => d.restaurant_id === restaurantId).id;
});
after(async () => {
  await pool?.end();
  await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await adminPool.end();
});

test('PostgreSQL health, eight researched categories and all three cities', async () => {
  assert.equal((await request(app).get('/api/health')).body.database, 'postgresql');
  assert.equal((await request(app).get('/api/categories')).body.length, 8);
  const all = (await request(app).get('/api/explore')).body;
  assert.equal(all.restaurants.length, 6);
  assert.equal(all.dishes.length, 18);
  for (const city of ['Colombo', 'Kandy', 'Galle']) {
    const r = await request(app).get('/api/explore').query({ city });
    assert.equal(r.status, 200);
    assert.equal(r.body.restaurants.length, 2);
    assert.ok(r.body.dishes.every((d: any) => d.city === city));
  }
});
test('Sinhala, Tamil and English search round-trip and SQL injection is treated as text', async () => {
  for (const q of ['බත්', 'சோறு', 'kottu']) {
    const r = await request(app).get('/api/explore').query({ q });
    assert.equal(r.status, 200);
    assert.ok(r.body.dishes.length > 0);
  }
  const injection = await request(app).get('/api/explore').query({ q: "%' OR 1=1 --" });
  assert.equal(injection.status, 200);
  assert.equal(injection.body.restaurants.length, 0);
  assert.equal(
    (await request(app).get('/api/explore').query({ q: '%' })).body.restaurants.length,
    0,
  );
});
test('Diet, category and spice constraints match the same dish', async () => {
  const r = await request(app).get('/api/explore').query({ vegan: 'true', spice: '0' });
  assert.equal(r.status, 200);
  assert.ok(r.body.dishes.length > 0);
  assert.ok(r.body.dishes.every((d: any) => d.vegan && d.vegetarian && d.spice === 0));
  const impossible = await request(app).get('/api/explore').query({ vegan: 'true', halal: 'true' });
  assert.equal(impossible.body.restaurants.length, 0);
  const seafood = await request(app)
    .get('/api/explore')
    .query({ category: 'seafood', halal: 'true' });
  assert.ok(seafood.body.dishes.length > 0);
  assert.ok(seafood.body.dishes.every((d: any) => d.category_slug === 'seafood' && d.halal));
  assert.equal((await request(app).get('/api/explore').query({ spice: 9 })).status, 400);
});
test('Anonymous writes, customer administration and cross-origin requests are rejected', async () => {
  assert.equal((await write(request(app), 'post', '/api/reviews', {})).status, 401);
  assert.equal((await customer.get('/api/admin/data')).status, 403);
  assert.equal((await write(moderator, 'post', '/api/admin/restaurants', {})).status, 403);
  assert.equal((await customer.post('/api/reviews').send({})).status, 403);
  assert.equal(
    (
      await customer
        .post('/api/reviews')
        .set('X-Requested-With', 'CeylonEats')
        .set('Origin', 'https://untrusted.example')
        .send({})
    ).status,
    403,
  );
});
test('Review validation, ownership and dish/restaurant integrity', async () => {
  const base = {
    restaurant_id: restaurantId,
    menu_item_id: dishId,
    body: 'A considered review of my meal.',
    food: 5,
    service: 4,
    value: 3,
    ambience: 4,
  };
  assert.equal((await write(customer, 'post', '/api/reviews', { ...base, food: 6 })).status, 400);
  assert.equal((await write(customer, 'post', '/api/reviews', { ...base, food: 4.5 })).status, 400);
  assert.equal(
    (await write(customer, 'post', '/api/reviews', { ...base, body: '   ' })).status,
    400,
  );
  const otherDish = (await request(app).get('/api/explore')).body.dishes.find(
    (d: any) => d.restaurant_id !== restaurantId,
  );
  assert.equal(
    (await write(customer, 'post', '/api/reviews', { ...base, menu_item_id: otherDish.id })).status,
    400,
  );
  assert.equal((await write(owner, 'post', '/api/reviews', base)).status, 403);
});
test('Pending reviews are private; approval updates restaurant and dish ratings; rejection reverses both', async () => {
  const before = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  const body = 'ආහාර රසවත්. உணவு சுவையாக இருந்தது. Excellent meal!';
  // A fresh account: every seeded customer already reviewed this dish, and one review per
  // subject per author is now enforced.
  const reviewer = await signUp('rating-maths');
  const posted = await write(reviewer, 'post', '/api/reviews', {
    restaurant_id: restaurantId,
    menu_item_id: dishId,
    body,
    food: 1,
    service: 2,
    value: 3,
    ambience: 4,
  });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.status, 'pending');
  const postId = posted.body.id;
  let detail = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  assert.equal(detail.restaurant.review_count, before.restaurant.review_count);
  assert.ok(!detail.reviews.some((p: any) => p.id === postId));
  assert.ok(
    (await reviewer.get('/api/my-postings')).body.some(
      (p: any) => p.id === postId && p.body === body,
    ),
  );
  assert.equal(
    (await write(moderator, 'patch', `/api/admin/postings/${postId}`, { status: 'approved' }))
      .status,
    200,
  );
  detail = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  assert.ok(detail.reviews.some((p: any) => p.id === postId && p.body === body));
  assert.equal(detail.restaurant.review_count, before.restaurant.review_count + 1);
  assert.ok(
    Math.abs(
      Number(detail.restaurant.rating) -
        (Number(before.restaurant.rating) * before.restaurant.review_count + 2.5) /
          (before.restaurant.review_count + 1),
    ) < 1e-9,
  );
  const oldDish = before.menu.find((d: any) => d.id === dishId);
  const newDish = detail.menu.find((d: any) => d.id === dishId);
  assert.ok(
    Math.abs(
      Number(newDish.rating) -
        (Number(oldDish.rating) * oldDish.review_count + 1) / (oldDish.review_count + 1),
    ) < 1e-9,
  );
  const comment = await write(customer, 'post', `/api/reviews/${postId}/replies`, {
    kind: 'comment',
    body: 'Thank you for this useful review.',
  });
  assert.equal(comment.status, 201);
  assert.equal(
    (
      await write(customer, 'post', `/api/reviews/${postId}/replies`, {
        kind: 'response',
        body: 'An unauthorised company response.',
      })
    ).status,
    403,
  );
  const response = await write(owner, 'post', `/api/reviews/${postId}/replies`, {
    kind: 'response',
    body: 'Thank you for visiting our restaurant.',
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'pending');
  detail = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  assert.ok(!detail.reviews.some((p: any) => [comment.body.id, response.body.id].includes(p.id)));
  for (const reply of [comment, response])
    assert.equal(
      (
        await write(moderator, 'patch', `/api/admin/postings/${reply.body.id}`, {
          status: 'approved',
        })
      ).status,
      200,
    );
  detail = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  assert.ok(detail.reviews.some((p: any) => p.id === comment.body.id));
  assert.ok(detail.reviews.some((p: any) => p.id === response.body.id));
  assert.equal(
    detail.restaurant.review_count,
    before.restaurant.review_count + 1,
    'Replies must not count as ratings',
  );
  assert.equal(
    (
      await write(moderator, 'patch', `/api/admin/postings/${postId}`, {
        status: 'rejected',
        reason: 'Test moderation reversal.',
      })
    ).status,
    200,
  );
  detail = (await request(app).get(`/api/restaurants/${restaurantId}`)).body;
  assert.equal(detail.restaurant.rating, before.restaurant.rating);
  assert.ok(
    !detail.reviews.some((p: any) => [postId, comment.body.id, response.body.id].includes(p.id)),
  );
  assert.equal(
    (
      await write(moderator, 'patch', `/api/admin/postings/${comment.body.id}`, {
        status: 'approved',
      })
    ).status,
    409,
  );
});
test('One review per dish and per restaurant, with resubmission after a rejection', async () => {
  const reviewer = await signUp('one-per-subject');
  const base = {
    restaurant_id: restaurantId,
    body: 'A first, considered account of this meal.',
    food: 4,
    service: 4,
    value: 4,
    ambience: 4,
  };
  const dish = await write(reviewer, 'post', '/api/reviews', { ...base, menu_item_id: dishId });
  assert.equal(dish.status, 201);
  // A second review of the same dish is refused, pending or approved.
  assert.equal(
    (await write(reviewer, 'post', '/api/reviews', { ...base, menu_item_id: dishId })).status,
    409,
  );
  // The restaurant as a whole is a separate subject, and so is another dish.
  const overall = await write(reviewer, 'post', '/api/reviews', base);
  assert.equal(overall.status, 201);
  assert.equal((await write(reviewer, 'post', '/api/reviews', base)).status, 409);
  const otherDish = (await request(app).get(`/api/restaurants/${restaurantId}`)).body.menu.find(
    (d: any) => d.id !== dishId,
  );
  assert.equal(
    (await write(reviewer, 'post', '/api/reviews', { ...base, menu_item_id: otherDish.id })).status,
    201,
  );
  // A rejected review frees the subject so the author can rewrite it.
  assert.equal(
    (
      await write(moderator, 'patch', `/api/admin/postings/${dish.body.id}`, {
        status: 'rejected',
        reason: 'Test rejection to allow a rewrite.',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await write(reviewer, 'post', '/api/reviews', {
        ...base,
        menu_item_id: dishId,
        body: 'A rewritten review after moderator feedback.',
      })
    ).status,
    201,
  );
});
test('Moderators cannot self-approve; rejection requires a reason', async () => {
  const p = await write(moderator, 'post', '/api/reviews', {
    restaurant_id: restaurantId,
    body: 'A review requiring independent moderation.',
    food: 4,
    service: 4,
    value: 4,
    ambience: 4,
  });
  assert.equal(p.status, 201);
  assert.equal(
    (await write(moderator, 'patch', `/api/admin/postings/${p.body.id}`, { status: 'approved' }))
      .status,
    403,
  );
  assert.equal(
    (await write(admin, 'patch', `/api/admin/postings/${p.body.id}`, { status: 'rejected' }))
      .status,
    400,
  );
  assert.equal(
    (
      await write(admin, 'patch', `/api/admin/postings/${p.body.id}`, {
        status: 'rejected',
        reason: 'Needs more detail about the visit.',
      })
    ).status,
    200,
  );
});
test('Admin creates and updates multilingual menus, content and images; price bands respond at boundaries', async () => {
  const r = await write(admin, 'post', '/api/admin/restaurants', {
    name: 'Price Boundary Test',
    city: 'Galle',
    address: 'Test-only location',
    description: 'A temporary venue for automated tests.',
    image_url: '',
  });
  assert.equal(r.status, 201);
  const rid = r.body.id;
  const empty = (await request(app).get('/api/explore').query({ q: 'Price Boundary Test' })).body;
  assert.equal(empty.restaurants.length, 1);
  assert.equal(empty.restaurants[0].price_band, 'unpriced');
  const category = (await request(app).get('/api/categories')).body[0].id;
  const base = {
    restaurant_id: rid,
    category_id: category,
    name: 'Rice test',
    name_si: 'බත්',
    name_ta: 'சோறு',
    description: 'A freshly prepared test dish.',
    price: 999.99,
    image_url: '',
    vegetarian: true,
    vegan: true,
    halal: false,
    spice: 0,
  };
  let m = await write(admin, 'post', '/api/admin/menu', base);
  assert.equal(m.status, 201);
  const mid = m.body.id;
  for (const [price, band] of [
    [999.99, 'budget'],
    [1000, 'mid'],
    [2500, 'mid'],
    [2500.01, 'premium'],
  ] as const) {
    assert.equal(
      (await write(admin, 'put', `/api/admin/menu/${mid}`, { ...base, price })).status,
      200,
    );
    const results = (await request(app).get('/api/explore').query({ band })).body;
    assert.ok(results.restaurants.some((r: any) => r.id === rid));
    const d = (await request(app).get(`/api/restaurants/${rid}`)).body;
    assert.equal(d.restaurant.price_band, band);
    assert.equal(Number(d.restaurant.avg_price), price);
    assert.equal(d.menu[0].name_ta, 'சோறு');
  }
  assert.equal(
    (await write(admin, 'put', `/api/admin/menu/${mid}`, { ...base, price: -1 })).status,
    400,
  );
  assert.equal(
    (await write(admin, 'put', `/api/admin/menu/${mid}`, { ...base, price: 0.001 })).status,
    400,
  );
  assert.equal(
    (await write(admin, 'put', `/api/admin/menu/${mid}`, { ...base, vegetarian: false })).status,
    400,
  );
  assert.equal(
    (
      await write(admin, 'put', `/api/admin/menu/${mid}`, {
        ...base,
        image_url: 'javascript:alert(1)',
      })
    ).status,
    400,
  );
  assert.equal(
    (await write(admin, 'put', `/api/admin/menu/${mid}`, { ...base, restaurant_id: restaurantId }))
      .status,
    400,
  );
  assert.equal(
    (
      await write(admin, 'put', `/api/admin/restaurants/${rid}`, {
        name: 'Renamed Test Venue',
        city: 'Kandy',
        address: 'Updated test address',
        description: 'Updated description.',
        image_url: 'https://example.com/image.jpg',
      })
    ).status,
    200,
  );
  const updated = (await request(app).get(`/api/restaurants/${rid}`)).body;
  assert.equal(updated.restaurant.name, 'Renamed Test Venue');
  assert.equal(updated.restaurant.image_url, 'https://example.com/image.jpg');
  assert.ok(
    (
      await pool.query(
        "SELECT 1 FROM audit_log WHERE entity_type='menu_item' AND entity_id=$1 AND action='update'",
        [mid],
      )
    ).rowCount! >= 4,
  );
});
test('Recommended sorting uses approved-review volume with the documented Bayesian prior', async () => {
  const r = (await request(app).get('/api/explore')).body.restaurants;
  for (let i = 0; i < r.length; i++) {
    const expected =
      (Number(r[i].rating || 0) * r[i].review_count + 17.5) / (r[i].review_count + 5);
    assert.ok(Math.abs(Number(r[i].rank_score) - expected) < 1e-9);
    if (i > 0) assert.ok(Number(r[i - 1].rank_score) >= Number(r[i].rank_score));
  }
});
test('Registration cannot grant staff roles and logout invalidates the server session', async () => {
  const agent = request.agent(app);
  const registered = await write(agent, 'post', '/api/auth/register', {
    name: 'New Test User',
    email: 'new-test@example.test',
    password,
    role: 'admin',
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.role, 'customer');
  assert.equal(registered.body.user.password_hash, undefined);
  assert.equal((await agent.get('/api/auth/me')).body.user.name, 'New Test User');
  assert.equal((await agent.get('/api/admin/data')).status, 403);
  const cookies = registered.headers['set-cookie'];
  await write(agent, 'post', '/api/auth/logout', {});
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookies)).body.user, null);
});
