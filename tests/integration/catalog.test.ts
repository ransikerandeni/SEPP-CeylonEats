import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { useTestDatabase, write } from './setup';

const ctx = useTestDatabase();
const explore = async (query: Record<string, string | number> = {}) =>
  (await request(ctx.app).get('/api/explore').query(query)).body;

describe('discovery', () => {
  test('health reports PostgreSQL, eight researched categories and two venues in each of three cities', async () => {
    expect((await request(ctx.app).get('/api/health')).body.database).toBe('postgresql');
    expect((await request(ctx.app).get('/api/categories')).body).toHaveLength(8);
    const all = await explore();
    expect(all.restaurants).toHaveLength(6);
    expect(all.dishes).toHaveLength(18);
    for (const city of ['Colombo', 'Kandy', 'Galle']) {
      const r = await request(ctx.app).get('/api/explore').query({ city });
      expect(r.status).toBe(200);
      expect(r.body.restaurants).toHaveLength(2);
      expect(r.body.dishes.every((d: any) => d.city === city)).toBe(true);
    }
  });

  test('Sinhala, Tamil and English search round-trip and SQL injection is treated as text', async () => {
    for (const q of ['බත්', 'சோறு', 'kottu']) {
      const r = await request(ctx.app).get('/api/explore').query({ q });
      expect(r.status).toBe(200);
      expect(r.body.dishes.length).toBeGreaterThan(0);
    }
    const injection = await request(ctx.app).get('/api/explore').query({ q: "%' OR 1=1 --" });
    expect(injection.status).toBe(200);
    expect(injection.body.restaurants).toHaveLength(0);
    expect((await explore({ q: '%' })).restaurants).toHaveLength(0);
  });

  test('diet, category and spice constraints must all match the same dish', async () => {
    const r = await request(ctx.app).get('/api/explore').query({ vegan: 'true', spice: '0' });
    expect(r.status).toBe(200);
    expect(r.body.dishes.length).toBeGreaterThan(0);
    expect(r.body.dishes.every((d: any) => d.vegan && d.vegetarian && d.spice === 0)).toBe(true);
    expect((await explore({ vegan: 'true', halal: 'true' })).restaurants).toHaveLength(0);
    const seafood = await explore({ category: 'seafood', halal: 'true' });
    expect(seafood.dishes.length).toBeGreaterThan(0);
    expect(seafood.dishes.every((d: any) => d.category_slug === 'seafood' && d.halal)).toBe(true);
    expect((await request(ctx.app).get('/api/explore').query({ spice: 9 })).status).toBe(400);
  });

  test('the price band filter narrows restaurants and dishes to restaurants in that band', async () => {
    const all = await explore();
    for (const band of ['budget', 'mid', 'premium']) {
      const r = await explore({ band });
      const expected = all.restaurants.filter((x: any) => x.price_band === band);
      expect(r.restaurants.map((x: any) => x.id).sort()).toEqual(
        expected.map((x: any) => x.id).sort(),
      );
      const ids = new Set(expected.map((x: any) => x.id));
      expect(r.dishes).toHaveLength(all.dishes.filter((d: any) => ids.has(d.restaurant_id)).length);
      expect(r.dishes.every((d: any) => ids.has(d.restaurant_id))).toBe(true);
    }
    expect((await request(ctx.app).get('/api/explore').query({ band: 'unpriced' })).status).toBe(
      400,
    );
  });

  test('an unknown restaurant id returns 404', async () => {
    const r = await request(ctx.app).get('/api/restaurants/999999');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Restaurant not found.');
  });
});

describe('sorting', () => {
  const nonDecreasing = (values: number[]) => values.every((v, i) => i === 0 || values[i - 1] <= v);
  const nonIncreasing = (values: number[]) => values.every((v, i) => i === 0 || values[i - 1] >= v);

  test('price-low orders restaurants by average price and dishes by price, ascending', async () => {
    const r = await explore({ sort: 'price-low' });
    expect(r.restaurants).toHaveLength(6);
    expect(nonDecreasing(r.restaurants.map((x: any) => Number(x.avg_price)))).toBe(true);
    expect(nonDecreasing(r.dishes.map((d: any) => Number(d.price)))).toBe(true);
    expect(Number(r.dishes[0].price)).toBe(280);
  });

  test('price-high orders restaurants by average price and dishes by price, descending', async () => {
    const r = await explore({ sort: 'price-high' });
    expect(nonIncreasing(r.restaurants.map((x: any) => Number(x.avg_price)))).toBe(true);
    expect(nonIncreasing(r.dishes.map((d: any) => Number(d.price)))).toBe(true);
    expect(Number(r.dishes[0].price)).toBe(4200);
  });

  test('name orders restaurants and dishes alphabetically', async () => {
    const r = await explore({ sort: 'name' });
    for (const list of [r.restaurants, r.dishes]) {
      const names = list.map((x: any) => x.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  test('rating orders by rating descending, breaking ties by review count', async () => {
    const r = await explore({ sort: 'rating' });
    for (const list of [r.restaurants, r.dishes])
      for (let i = 1; i < list.length; i++) {
        const [a, b] = [list[i - 1], list[i]];
        if (b.rating === null) continue;
        expect(a.rating).not.toBeNull();
        expect(Number(a.rating)).toBeGreaterThanOrEqual(Number(b.rating));
        if (Number(a.rating) === Number(b.rating))
          expect(a.review_count).toBeGreaterThanOrEqual(b.review_count);
      }
  });

  test('recommended sorting uses approved-review volume with the documented Bayesian prior', async () => {
    // Vary review volume so the prior actually separates the restaurants.
    const reviewer = await ctx.signUp('bayesian');
    const target = (await explore()).restaurants.at(-1);
    const menu = (await request(ctx.app).get(`/api/restaurants/${target.id}`)).body.menu;
    for (const menu_item_id of [null, ...menu.map((d: any) => d.id)]) {
      const posted = await write(reviewer, 'post', '/api/reviews', {
        restaurant_id: target.id,
        menu_item_id,
        body: 'A review that adds volume to this venue.',
        food: 2,
        service: 2,
        value: 3,
        ambience: 2,
      });
      expect(posted.status).toBe(201);
      const approved = await write(
        ctx.moderator,
        'patch',
        `/api/admin/postings/${posted.body.id}`,
        {
          status: 'approved',
        },
      );
      expect(approved.status).toBe(200);
    }

    const r = (await explore()).restaurants;
    expect(new Set(r.map((x: any) => x.review_count)).size).toBeGreaterThan(1);
    for (let i = 0; i < r.length; i++) {
      const expected =
        (Number(r[i].rating || 0) * r[i].review_count + 17.5) / (r[i].review_count + 5);
      expect(Number(r[i].rank_score)).toBeCloseTo(expected, 9);
      if (i > 0)
        expect(Number(r[i - 1].rank_score)).toBeGreaterThanOrEqual(Number(r[i].rank_score));
    }
  });
});
