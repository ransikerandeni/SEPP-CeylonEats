import { beforeAll, describe, expect, test } from 'vitest';
import { useTestDatabase } from './setup';

const ctx = useTestDatabase();
let categoryId: number;
let users: number[];
let venues = 0;

const one = async (sql: string, values: unknown[] = []) =>
  (await ctx.pool.query(sql, values)).rows[0];
const newRestaurant = async () =>
  (
    await one(
      "INSERT INTO restaurants(name,city,address,description) VALUES($1,'Galle','View test address','View test venue.') RETURNING id",
      [`View Test Venue ${++venues}`],
    )
  ).id as number;
const addDish = async (restaurantId: number, price: number, name = 'View test dish') =>
  (
    await one(
      "INSERT INTO menu_items(restaurant_id,category_id,name,description,price,spice) VALUES($1,$2,$3,'A dish for view tests.',$4,1) RETURNING id",
      [restaurantId, categoryId, name, price],
    )
  ).id as number;
const addReview = async (
  author: number,
  restaurantId: number,
  scores: [number, number, number, number],
  status: 'pending' | 'approved' | 'rejected',
  menuItemId: number | null = null,
) =>
  (
    await one(
      "INSERT INTO postings(author_id,restaurant_id,menu_item_id,kind,body,food,service,value,ambience,status) VALUES($1,$2,$3,'review','A review for view tests.',$4,$5,$6,$7,$8) RETURNING id",
      [author, restaurantId, menuItemId, ...scores, status],
    )
  ).id as number;
const restaurantStats = (id: number) => one('SELECT * FROM restaurant_stats WHERE id=$1', [id]);
const menuStats = (id: number) => one('SELECT * FROM menu_stats WHERE id=$1', [id]);

beforeAll(async () => {
  categoryId = (await one("SELECT id FROM categories WHERE slug='seafood'")).id;
  users = [];
  for (const n of [1, 2, 3])
    users.push(
      (
        await one(
          "INSERT INTO users(name,email,password_hash) VALUES($1,$2,'not-a-real-hash') RETURNING id",
          [`View Tester ${n}`, `view-tester-${n}@example.test`],
        )
      ).id,
    );
});

describe('restaurant_stats prices', () => {
  test('a restaurant with no menu is unpriced with no price statistics', async () => {
    const stats = await restaurantStats(await newRestaurant());
    expect(stats).toMatchObject({
      price_band: 'unpriced',
      avg_price: null,
      min_price: null,
      max_price: null,
      menu_count: 0,
    });
  });

  test('average, minimum, maximum and count summarise the whole menu', async () => {
    const id = await newRestaurant();
    for (const price of [500, 1000, 1600]) await addDish(id, price);
    const stats = await restaurantStats(id);
    expect(stats).toMatchObject({
      avg_price: '1033.33',
      min_price: '500.00',
      max_price: '1600.00',
      menu_count: 3,
      price_band: 'mid',
    });
  });

  test('price bands are budget below 1000, mid from 1000 to 2500 inclusive and premium above', async () => {
    const id = await newRestaurant();
    const dishId = await addDish(id, 1);
    for (const [price, band] of [
      [1, 'budget'],
      [999.99, 'budget'],
      [1000, 'mid'],
      [2500, 'mid'],
      [2500.01, 'premium'],
      [1000000, 'premium'],
    ] as const) {
      await ctx.pool.query('UPDATE menu_items SET price=$1 WHERE id=$2', [price, dishId]);
      const stats = await restaurantStats(id);
      expect(stats.price_band, `price ${price}`).toBe(band);
      expect(Number(stats.avg_price)).toBe(price);
    }
  });

  test('the band follows the average rounded to cents', async () => {
    const id = await newRestaurant();
    await addDish(id, 999.99);
    await addDish(id, 1000);
    const stats = await restaurantStats(id);
    expect(stats.avg_price).toBe('1000.00');
    expect(stats.price_band).toBe('mid');
  });
});

describe('restaurant_stats ratings', () => {
  test('with no reviews the rating is null and rank_score equals the 3.5 prior', async () => {
    const id = await newRestaurant();
    await addReview(users[0], id, [5, 5, 5, 5], 'pending');
    await addReview(users[1], id, [5, 5, 5, 5], 'rejected');
    const stats = await restaurantStats(id);
    expect(stats.review_count).toBe(0);
    expect(stats.rating).toBeNull();
    expect(Number(stats.rank_score)).toBe(3.5);
  });

  test('rating averages the four criteria over approved reviews only, excluding replies', async () => {
    const id = await newRestaurant();
    const dishId = await addDish(id, 1200);
    const approved = await addReview(users[0], id, [5, 4, 3, 4], 'approved'); // 4.0
    await addReview(users[1], id, [2, 3, 3, 4], 'approved'); // 3.0
    await addReview(users[0], id, [1, 2, 2, 3], 'approved', dishId); // 2.0
    await addReview(users[1], id, [4, 1, 1, 2], 'approved', dishId); // 2.0
    await addReview(users[2], id, [1, 1, 1, 1], 'pending');
    await addReview(users[2], id, [1, 1, 1, 1], 'rejected', dishId);
    await ctx.pool.query(
      "INSERT INTO postings(author_id,restaurant_id,parent_id,kind,body,status) VALUES($1,$2,$3,'comment','An approved comment.','approved'),($1,$2,$3,'response','An approved response.','approved')",
      [users[2], id, approved],
    );

    const stats = await restaurantStats(id);
    expect(stats.review_count).toBe(4);
    expect(Number(stats.rating)).toBeCloseTo(2.75, 9);
    expect(Number(stats.rank_score)).toBeCloseTo((2.75 * 4 + 3.5 * 5) / (4 + 5), 9);
  });
});

describe('menu_stats', () => {
  test('dish rating averages only the food score of approved reviews of that dish', async () => {
    const id = await newRestaurant();
    const dishId = await addDish(id, 800, 'Rated dish');
    const otherDishId = await addDish(id, 900, 'Other dish');
    await addReview(users[0], id, [1, 5, 5, 5], 'approved', dishId);
    await addReview(users[1], id, [4, 5, 5, 5], 'approved', dishId);
    await addReview(users[2], id, [5, 5, 5, 5], 'rejected', dishId);
    await addReview(users[2], id, [5, 5, 5, 5], 'pending', dishId);
    await addReview(users[0], id, [5, 5, 5, 5], 'approved', otherDishId);
    await addReview(users[1], id, [5, 5, 5, 5], 'approved');

    const stats = await menuStats(dishId);
    expect(stats).toMatchObject({
      review_count: 2,
      restaurant_id: id,
      restaurant_name: `View Test Venue ${venues}`,
      city: 'Galle',
      category_slug: 'seafood',
    });
    expect(Number(stats.rating)).toBeCloseTo(2.5, 9);
    expect(Number(stats.rank_score)).toBeCloseTo((2.5 * 2 + 3.5 * 5) / (2 + 5), 9);
    expect(Number((await menuStats(otherDishId)).rating)).toBe(5);
  });

  test('an unreviewed dish has a null rating and the 3.5 prior as rank_score', async () => {
    const stats = await menuStats(await addDish(await newRestaurant(), 450));
    expect(stats.review_count).toBe(0);
    expect(stats.rating).toBeNull();
    expect(Number(stats.rank_score)).toBe(3.5);
  });
});
