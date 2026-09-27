import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { useTestDatabase, write } from './setup';

const ctx = useTestDatabase();
const detailOf = async (id: number) => (await request(ctx.app).get(`/api/restaurants/${id}`)).body;

describe('submitting reviews', () => {
  test('review validation, ownership and dish/restaurant integrity are enforced', async () => {
    const base = {
      restaurant_id: ctx.restaurantId,
      menu_item_id: ctx.dishId,
      body: 'A considered review of my meal.',
      food: 5,
      service: 4,
      value: 3,
      ambience: 4,
    };
    const post = (body: object) => write(ctx.customer, 'post', '/api/reviews', body);
    expect((await post({ ...base, food: 6 })).status).toBe(400);
    expect((await post({ ...base, food: 4.5 })).status).toBe(400);
    expect((await post({ ...base, body: '   ' })).status).toBe(400);
    const otherDish = (await request(ctx.app).get('/api/explore')).body.dishes.find(
      (d: any) => d.restaurant_id !== ctx.restaurantId,
    );
    expect((await post({ ...base, menu_item_id: otherDish.id })).status).toBe(400);
    expect((await post({ ...base, restaurant_id: 999999 })).status).toBe(404);
    expect((await write(ctx.owner, 'post', '/api/reviews', base)).status).toBe(403);
  });

  test('one review per dish and per restaurant, with resubmission after a rejection', async () => {
    const reviewer = await ctx.signUp('one-per-subject');
    const base = {
      restaurant_id: ctx.restaurantId,
      body: 'A first, considered account of this meal.',
      food: 4,
      service: 4,
      value: 4,
      ambience: 4,
    };
    const dish = await write(reviewer, 'post', '/api/reviews', {
      ...base,
      menu_item_id: ctx.dishId,
    });
    expect(dish.status).toBe(201);
    const again = await write(reviewer, 'post', '/api/reviews', {
      ...base,
      menu_item_id: ctx.dishId,
    });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe(
      'You have already reviewed this dish. Your earlier review still stands.',
    );
    const overall = await write(reviewer, 'post', '/api/reviews', base);
    expect(overall.status).toBe(201);
    const overallAgain = await write(reviewer, 'post', '/api/reviews', base);
    expect(overallAgain.status).toBe(409);
    expect(overallAgain.body.error).toBe(
      'You have already reviewed this restaurant. Your earlier review still stands.',
    );
    const otherDish = (await detailOf(ctx.restaurantId)).menu.find((d: any) => d.id !== ctx.dishId);
    expect(
      (await write(reviewer, 'post', '/api/reviews', { ...base, menu_item_id: otherDish.id }))
        .status,
    ).toBe(201);
    expect(
      (
        await write(ctx.moderator, 'patch', `/api/admin/postings/${dish.body.id}`, {
          status: 'rejected',
          reason: 'Test rejection to allow a rewrite.',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await write(reviewer, 'post', '/api/reviews', {
          ...base,
          menu_item_id: ctx.dishId,
          body: 'A rewritten review after moderator feedback.',
        })
      ).status,
    ).toBe(201);
  });

  test('my-postings requires sign-in and returns only the caller’s own postings', async () => {
    expect((await request(ctx.app).get('/api/my-postings')).status).toBe(401);
    const first = await ctx.signUp('mine-a');
    const second = await ctx.signUp('mine-b');
    const body = {
      restaurant_id: ctx.restaurantId,
      body: 'A review that belongs to its author only.',
      food: 3,
      service: 3,
      value: 3,
      ambience: 3,
    };
    const a = await write(first, 'post', '/api/reviews', body);
    const b = await write(second, 'post', '/api/reviews', body);
    expect([a.status, b.status]).toEqual([201, 201]);
    for (const [agent, own, other] of [
      [first, a.body.id, b.body.id],
      [second, b.body.id, a.body.id],
    ] as const) {
      const me = (await agent.get('/api/auth/me')).body.user;
      const mine = (await agent.get('/api/my-postings')).body;
      expect(mine.map((p: any) => p.id)).toEqual([own]);
      expect(mine.every((p: any) => p.author_id === me.id)).toBe(true);
      expect(mine.some((p: any) => p.id === other)).toBe(false);
      expect(mine[0].restaurant_name).toBeTruthy();
    }
    const seeded = (await ctx.customer.get('/api/my-postings')).body;
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.some((p: any) => [a.body.id, b.body.id].includes(p.id))).toBe(false);
  });
});

describe('ratings', () => {
  test('pending reviews are private; approval updates restaurant and dish ratings; rejection reverses both', async () => {
    const { restaurantId, dishId, customer, moderator, owner } = ctx;
    const before = await detailOf(restaurantId);
    const body = 'ආහාර රසවත්. உணவு சுவையாக இருந்தது. Excellent meal!';
    const reviewer = await ctx.signUp('rating-maths');
    const posted = await write(reviewer, 'post', '/api/reviews', {
      restaurant_id: restaurantId,
      menu_item_id: dishId,
      body,
      food: 1,
      service: 2,
      value: 3,
      ambience: 4,
    });
    expect(posted.status).toBe(201);
    expect(posted.body.status).toBe('pending');
    const postId = posted.body.id;
    let detail = await detailOf(restaurantId);
    expect(detail.restaurant.review_count).toBe(before.restaurant.review_count);
    expect(detail.reviews.some((p: any) => p.id === postId)).toBe(false);
    expect(
      (await reviewer.get('/api/my-postings')).body.some(
        (p: any) => p.id === postId && p.body === body,
      ),
    ).toBe(true);

    // A reply can only be attached once the review is published.
    expect(
      (
        await write(customer, 'post', `/api/reviews/${postId}/replies`, {
          kind: 'comment',
          body: 'Replying before publication.',
        })
      ).status,
    ).toBe(404);

    expect(
      (await write(moderator, 'patch', `/api/admin/postings/${postId}`, { status: 'approved' }))
        .status,
    ).toBe(200);
    detail = await detailOf(restaurantId);
    expect(detail.reviews.some((p: any) => p.id === postId && p.body === body)).toBe(true);
    expect(detail.restaurant.review_count).toBe(before.restaurant.review_count + 1);
    expect(Number(detail.restaurant.rating)).toBeCloseTo(
      (Number(before.restaurant.rating) * before.restaurant.review_count + 2.5) /
        (before.restaurant.review_count + 1),
      9,
    );
    const oldDish = before.menu.find((d: any) => d.id === dishId);
    const newDish = detail.menu.find((d: any) => d.id === dishId);
    expect(Number(newDish.rating)).toBeCloseTo(
      (Number(oldDish.rating) * oldDish.review_count + 1) / (oldDish.review_count + 1),
      9,
    );

    const comment = await write(customer, 'post', `/api/reviews/${postId}/replies`, {
      kind: 'comment',
      body: 'Thank you for this useful review.',
    });
    expect(comment.status).toBe(201);
    expect(
      (
        await write(customer, 'post', `/api/reviews/${postId}/replies`, {
          kind: 'response',
          body: 'An unauthorised company response.',
        })
      ).status,
    ).toBe(403);
    const response = await write(owner, 'post', `/api/reviews/${postId}/replies`, {
      kind: 'response',
      body: 'Thank you for visiting our restaurant.',
    });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    detail = await detailOf(restaurantId);
    expect(
      detail.reviews.some((p: any) => [comment.body.id, response.body.id].includes(p.id)),
    ).toBe(false);
    for (const reply of [comment, response])
      expect(
        (
          await write(moderator, 'patch', `/api/admin/postings/${reply.body.id}`, {
            status: 'approved',
          })
        ).status,
      ).toBe(200);
    detail = await detailOf(restaurantId);
    expect(detail.reviews.some((p: any) => p.id === comment.body.id)).toBe(true);
    expect(detail.reviews.some((p: any) => p.id === response.body.id)).toBe(true);
    expect(detail.restaurant.review_count, 'Replies must not count as ratings').toBe(
      before.restaurant.review_count + 1,
    );

    expect(
      (
        await write(moderator, 'patch', `/api/admin/postings/${postId}`, {
          status: 'rejected',
          reason: 'Test moderation reversal.',
        })
      ).status,
    ).toBe(200);
    detail = await detailOf(restaurantId);
    expect(detail.restaurant.rating).toBe(before.restaurant.rating);
    expect(
      detail.reviews.some((p: any) => [postId, comment.body.id, response.body.id].includes(p.id)),
    ).toBe(false);
    expect(
      (
        await write(moderator, 'patch', `/api/admin/postings/${comment.body.id}`, {
          status: 'approved',
        })
      ).status,
    ).toBe(409);
  });
});
