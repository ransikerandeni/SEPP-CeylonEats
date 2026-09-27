import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import credits from '../../public/image-credits.json';
import { restaurantSchema } from '../../server/validation';
import { sampleImage, sampleImages } from '../../server/images';

describe('bundled catalog images', () => {
  it('all 24 catalog photos are distinct bundled JPEGs with attribution', () => {
    expect(credits).toHaveLength(24);
    expect(credits.filter((i) => i.kind === 'restaurant')).toHaveLength(6);
    const hashes = new Set<string>();
    for (const item of credits) {
      const bytes = readFileSync(new URL(`../../public${item.file}`, import.meta.url));
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.length).toBeGreaterThan(1000);
      hashes.add(createHash('sha256').update(bytes).digest('hex'));
      expect(item.author).toBeTruthy();
      expect(item.license).toBeTruthy();
      expect(item.sourceUrl.startsWith('https://')).toBe(true);
    }
    expect(hashes.size).toBe(24);
  });

  it('catalog image validation permits owned assets and HTTPS but rejects unsafe paths', () => {
    const base = {
      name: 'Test venue',
      city: 'Galle',
      address: 'Test address',
      description: 'Sample restaurant',
    };
    for (const image_url of ['/images/fish-curry.jpg', 'https://example.com/photo.jpg', ''])
      expect(restaurantSchema.safeParse({ ...base, image_url }).success).toBe(true);
    for (const image_url of [
      '/images/../.env',
      '//example.com/x.jpg',
      'javascript:alert(1)',
      'http://example.com/x.jpg',
      '/images/x.svg',
    ])
      expect(restaurantSchema.safeParse({ ...base, image_url }).success).toBe(false);
  });

  it('every bundled file path passes the catalog image validation', () => {
    for (const item of credits)
      expect(restaurantSchema.shape.image_url.safeParse(item.file).success).toBe(true);
  });
});

describe('sampleImage', () => {
  it('exposes the credits list as sampleImages', () => {
    expect(sampleImages).toBe(credits);
  });

  it('returns the bundled file for a known restaurant', () => {
    expect(sampleImage('Kandy Clay Pot', 'restaurant')).toBe('/images/kandy-clay-pot.jpg');
  });

  it('returns the bundled file for a known dish', () => {
    expect(sampleImage('Village rice & curry', 'dish')).toBe('/images/village-rice-curry.jpg');
  });

  it('throws for a name that has no bundled image', () => {
    expect(() => sampleImage('Imaginary Diner', 'restaurant')).toThrow(
      'Missing sample image: Imaginary Diner',
    );
  });

  it('throws when the name exists under a different kind', () => {
    expect(() => sampleImage('Kandy Clay Pot', 'dish')).toThrow(
      'Missing sample image: Kandy Clay Pot',
    );
  });
});
