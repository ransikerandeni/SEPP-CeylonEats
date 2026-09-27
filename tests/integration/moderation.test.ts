import { describe, expect, test } from 'vitest';
import { type Agent, useTestDatabase, write } from './setup';

const ctx = useTestDatabase();
const review = {
  body: 'A review requiring independent moderation.',
  food: 4,
  service: 4,
  value: 4,
  ambience: 4,
};
const moderate = (agent: Agent, id: number, body: object) =>
  write(agent, 'patch', `/api/admin/postings/${id}`, body);

describe('moderation', () => {
  test('moderators cannot self-approve and rejection requires a reason', async () => {
    const p = await write(ctx.moderator, 'post', '/api/reviews', {
      ...review,
      restaurant_id: ctx.restaurantId,
    });
    expect(p.status).toBe(201);
    const self = await moderate(ctx.moderator, p.body.id, { status: 'approved' });
    expect(self.status).toBe(403);
    expect(self.body.error).toBe('Another moderator must review your own posting.');
    expect((await moderate(ctx.admin, p.body.id, { status: 'rejected' })).status).toBe(400);
    expect(
      (
        await moderate(ctx.admin, p.body.id, {
          status: 'rejected',
          reason: 'Needs more detail about the visit.',
        })
      ).status,
    ).toBe(200);
  });

  test('customers cannot moderate and a nonexistent posting returns 404', async () => {
    expect((await moderate(ctx.customer, 1, { status: 'approved' })).status).toBe(403);
    const missing = await moderate(ctx.moderator, 999999, { status: 'approved' });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Posting not found.');
  });

  test('moderation records who changed the status, from what, to what and why', async () => {
    const reviewer = await ctx.signUp('audited');
    const p = await write(reviewer, 'post', '/api/reviews', {
      ...review,
      restaurant_id: ctx.restaurantId,
    });
    expect(p.status).toBe(201);
    expect((await moderate(ctx.moderator, p.body.id, { status: 'approved' })).status).toBe(200);
    const rejected = await moderate(ctx.moderator, p.body.id, {
      status: 'rejected',
      reason: '  Contains a personal attack.  ',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.moderation_reason).toBe('Contains a personal attack.');

    const moderatorId = (await ctx.moderator.get('/api/auth/me')).body.user.id;
    expect(rejected.body.moderated_by).toBe(moderatorId);
    const log = await ctx.pool.query(
      "SELECT actor_id,action,detail FROM audit_log WHERE entity_type='posting' AND entity_id=$1 ORDER BY id",
      [p.body.id],
    );
    expect(log.rows).toEqual([
      {
        actor_id: moderatorId,
        action: 'moderate',
        detail: { from: 'pending', to: 'approved', reason: '' },
      },
      {
        actor_id: moderatorId,
        action: 'moderate',
        detail: { from: 'approved', to: 'rejected', reason: 'Contains a personal attack.' },
      },
    ]);
  });

  test('approving a reply whose parent review is pending is refused until the parent is approved', async () => {
    const reviewer = await ctx.signUp('parent-pending');
    const parent = await write(reviewer, 'post', '/api/reviews', {
      ...review,
      restaurant_id: ctx.restaurantId,
    });
    expect((await moderate(ctx.moderator, parent.body.id, { status: 'approved' })).status).toBe(
      200,
    );
    const reply = await write(ctx.customer, 'post', `/api/reviews/${parent.body.id}/replies`, {
      kind: 'comment',
      body: 'A reply to a review that goes back to the queue.',
    });
    expect(reply.status).toBe(201);
    // The API offers no transition back to pending, so put the parent there directly.
    await ctx.pool.query("UPDATE postings SET status='pending' WHERE id=$1", [parent.body.id]);

    const blocked = await moderate(ctx.moderator, reply.body.id, { status: 'approved' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('Approve the parent review first.');
    const unchanged = await ctx.pool.query('SELECT status FROM postings WHERE id=$1', [
      reply.body.id,
    ]);
    expect(unchanged.rows[0].status).toBe('pending');

    expect(
      (
        await moderate(ctx.moderator, reply.body.id, {
          status: 'rejected',
          reason: 'Rejecting does not need the parent.',
        })
      ).status,
    ).toBe(200);
    expect((await moderate(ctx.moderator, parent.body.id, { status: 'approved' })).status).toBe(
      200,
    );
    expect((await moderate(ctx.moderator, reply.body.id, { status: 'approved' })).status).toBe(200);
  });
});
