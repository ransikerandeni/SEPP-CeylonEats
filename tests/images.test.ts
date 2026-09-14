import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import credits from '../public/image-credits.json';
import { restaurantSchema } from '../server/validation';
test('all 24 catalog photos are distinct bundled JPEGs with attribution', () => {
  assert.equal(credits.length, 24);
  assert.equal(credits.filter((i) => i.kind === 'restaurant').length, 6);
  const hashes = new Set();
  for (const item of credits) {
    const bytes = readFileSync(new URL(`../public${item.file}`, import.meta.url));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.ok(bytes.length > 1000);
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
    assert.ok(item.author && item.license && item.sourceUrl.startsWith('https://'));
  }
  assert.equal(hashes.size, 24);
});
test('catalog image validation permits owned assets and HTTPS but rejects unsafe paths', () => {
  const base = {
    name: 'Test venue',
    city: 'Galle',
    address: 'Test address',
    description: 'Sample restaurant',
  };
  for (const image_url of ['/images/fish-curry.jpg', 'https://example.com/photo.jpg', ''])
    assert.equal(restaurantSchema.safeParse({ ...base, image_url }).success, true);
  for (const image_url of [
    '/images/../.env',
    '//example.com/x.jpg',
    'javascript:alert(1)',
    'http://example.com/x.jpg',
    '/images/x.svg',
  ])
    assert.equal(restaurantSchema.safeParse({ ...base, image_url }).success, false);
});
