import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { useTestDatabase, write } from './setup';

const ctx = useTestDatabase();
const venue = {
  name: 'Admin Test Venue',
  city: 'Galle',
  address: 'Test-only location',
  description: 'A temporary venue for automated tests.',
  image_url: '',
};
const dish = async (restaurant_id: number) => ({
  restaurant_id,
  category_id: (await request(ctx.app).get('/api/categories')).body[0].id,
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
});
const ownerId = async () => (await ctx.owner.get('/api/auth/me')).body.user.id as number;

describe('staff data', () => {
  test('admin data is for staff only and only administrators see the owner list', async () => {
    expect((await request(ctx.app).get('/api/admin/data')).status).toBe(401);

    const moderator = await ctx.moderator.get('/api/admin/data');
    expect(moderator.status).toBe(200);
    expect(moderator.body.restaurants).toHaveLength(6);
    expect(moderator.body.menu).toHaveLength(18);
    expect(moderator.body.postings.length).toBeGreaterThanOrEqual(19);
    expect(moderator.body.postings.some((p: any) => p.status === 'pending')).toBe(true);
    expect(moderator.body.owners).toEqual([]);

    const admin = await ctx.admin.get('/api/admin/data');
    expect(admin.status).toBe(200);
    expect(admin.body.postings).toHaveLength(moderator.body.postings.length);
    expect(admin.body.owners).toEqual([{ id: await ownerId(), name: 'Restaurant Partner' }]);
  });
});

describe('restaurants and menus', () => {
  test('admin creates and updates multilingual menus, content and images; price bands respond at boundaries', async () => {
    const r = await write(ctx.admin, 'post', '/api/admin/restaurants', {
      ...venue,
      name: 'Price Boundary Test',
    });
    expect(r.status).toBe(201);
    const rid = r.body.id;
    const empty = (await request(ctx.app).get('/api/explore').query({ q: 'Price Boundary Test' }))
      .body;
    expect(empty.restaurants).toHaveLength(1);
    expect(empty.restaurants[0].price_band).toBe('unpriced');
    const base = await dish(rid);
    const m = await write(ctx.admin, 'post', '/api/admin/menu', base);
    expect(m.status).toBe(201);
    const mid = m.body.id;
    for (const [price, band] of [
      [999.99, 'budget'],
      [1000, 'mid'],
      [2500, 'mid'],
      [2500.01, 'premium'],
    ] as const) {
      expect(
        (await write(ctx.admin, 'put', `/api/admin/menu/${mid}`, { ...base, price })).status,
      ).toBe(200);
      const results = (await request(ctx.app).get('/api/explore').query({ band })).body;
      expect(results.restaurants.some((x: any) => x.id === rid)).toBe(true);
      const d = (await request(ctx.app).get(`/api/restaurants/${rid}`)).body;
      expect(d.restaurant.price_band).toBe(band);
      expect(Number(d.restaurant.avg_price)).toBe(price);
      expect(d.menu[0].name_ta).toBe('சோறு');
    }
    const put = (body: object) => write(ctx.admin, 'put', `/api/admin/menu/${mid}`, body);
    expect((await put({ ...base, price: -1 })).status).toBe(400);
    expect((await put({ ...base, price: 0.001 })).status).toBe(400);
    expect((await put({ ...base, vegetarian: false })).status).toBe(400);
    expect((await put({ ...base, image_url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await put({ ...base, restaurant_id: ctx.restaurantId })).status).toBe(400);
    expect(
      (
        await write(ctx.admin, 'put', `/api/admin/restaurants/${rid}`, {
          name: 'Renamed Test Venue',
          city: 'Kandy',
          address: 'Updated test address',
          description: 'Updated description.',
          image_url: 'https://example.com/image.jpg',
        })
      ).status,
    ).toBe(200);
    const updated = (await request(ctx.app).get(`/api/restaurants/${rid}`)).body;
    expect(updated.restaurant.name).toBe('Renamed Test Venue');
    expect(updated.restaurant.image_url).toBe('https://example.com/image.jpg');
    const audit = await ctx.pool.query(
      "SELECT 1 FROM audit_log WHERE entity_type='menu_item' AND entity_id=$1 AND action='update'",
      [mid],
    );
    expect(audit.rowCount).toBeGreaterThanOrEqual(4);
  });

  test('creating a restaurant and menu item is audited with the acting administrator', async () => {
    const adminId = (await ctx.admin.get('/api/auth/me')).body.user.id;
    const r = await write(ctx.admin, 'post', '/api/admin/restaurants', {
      ...venue,
      name: 'Audited Venue',
    });
    const m = await write(ctx.admin, 'post', '/api/admin/menu', {
      ...(await dish(r.body.id)),
      price: 1234.5,
    });
    expect([r.status, m.status]).toEqual([201, 201]);
    const rows = (
      await ctx.pool.query(
        "SELECT actor_id,action,entity_type,entity_id,detail FROM audit_log WHERE action='create' AND ((entity_type='restaurant' AND entity_id=$1) OR (entity_type='menu_item' AND entity_id=$2)) ORDER BY id",
        [r.body.id, m.body.id],
      )
    ).rows;
    expect(rows).toEqual([
      {
        actor_id: adminId,
        action: 'create',
        entity_type: 'restaurant',
        entity_id: r.body.id,
        detail: {},
      },
      {
        actor_id: adminId,
        action: 'create',
        entity_type: 'menu_item',
        entity_id: m.body.id,
        detail: { price: 1234.5 },
      },
    ]);
  });

  test('updating a nonexistent restaurant or menu item returns 404 without auditing', async () => {
    const before = (await ctx.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n;
    const restaurant = await write(ctx.admin, 'put', '/api/admin/restaurants/999999', venue);
    expect(restaurant.status).toBe(404);
    expect(restaurant.body.error).toBe('Restaurant not found.');
    const menu = await write(
      ctx.admin,
      'put',
      '/api/admin/menu/999999',
      await dish(ctx.restaurantId),
    );
    expect(menu.status).toBe(404);
    expect(menu.body.error).toBe('Dish not found.');
    expect((await ctx.pool.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n).toBe(
      before,
    );
  });

  test('a menu item for a nonexistent restaurant is rejected as a related-entry error', async () => {
    const r = await write(ctx.admin, 'post', '/api/admin/menu', await dish(999999));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Check the related entry and required field values.');
  });

  test('only a user with the owner role can be assigned as a restaurant owner', async () => {
    const customerId = (await ctx.customer.get('/api/auth/me')).body.user.id;
    const created = await write(ctx.admin, 'post', '/api/admin/restaurants', {
      ...venue,
      owner_id: customerId,
    });
    expect(created.status).toBe(400);
    expect(created.body.error).toBe('Choose a restaurant owner.');
    const updated = await write(ctx.admin, 'put', `/api/admin/restaurants/${ctx.restaurantId}`, {
      ...venue,
      owner_id: customerId,
    });
    expect(updated.status).toBe(400);
  });

  test('an assigned owner can post a company response only on their own restaurant', async () => {
    const r = await write(ctx.admin, 'post', '/api/admin/restaurants', {
      ...venue,
      name: 'Unowned Venue',
    });
    expect(r.status).toBe(201);
    expect(r.body.owner_id).toBeNull();
    const posted = await write(ctx.customer, 'post', '/api/reviews', {
      restaurant_id: r.body.id,
      body: 'A review of a venue that has no owner yet.',
      food: 4,
      service: 4,
      value: 4,
      ambience: 4,
    });
    expect(posted.status).toBe(201);
    expect(
      (
        await write(ctx.moderator, 'patch', `/api/admin/postings/${posted.body.id}`, {
          status: 'approved',
        })
      ).status,
    ).toBe(200);
    const respond = () =>
      write(ctx.owner, 'post', `/api/reviews/${posted.body.id}/replies`, {
        kind: 'response',
        body: 'Thank you for visiting our restaurant.',
      });

    const refused = await respond();
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe(
      'Only the restaurant representative or portal administrator can post a company response.',
    );

    const assigned = await write(ctx.admin, 'put', `/api/admin/restaurants/${r.body.id}`, {
      ...venue,
      name: 'Unowned Venue',
      owner_id: await ownerId(),
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.owner_id).toBe(await ownerId());
    const accepted = await respond();
    expect(accepted.status).toBe(201);
    expect(accepted.body.status).toBe('pending');
    expect(
      (
        await write(ctx.owner, 'post', '/api/reviews', {
          restaurant_id: r.body.id,
          body: 'Reviewing my own venue.',
          food: 5,
          service: 5,
          value: 5,
          ambience: 5,
        })
      ).status,
    ).toBe(403);
  });
});
