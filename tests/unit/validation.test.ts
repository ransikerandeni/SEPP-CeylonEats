import { describe, it, expect } from 'vitest';
import {
  restaurantSchema,
  menuSchema,
  reviewSchema,
  replySchema,
  registerSchema,
  loginSchema,
  moderationSchema,
  filtersSchema,
} from '../../server/validation';

const restaurant = {
  name: 'Test venue',
  city: 'Galle',
  address: 'Test address',
  description: 'Sample restaurant',
  image_url: '',
};
const dish = {
  restaurant_id: 1,
  category_id: 1,
  name: 'Fish curry',
  description: 'Southern sour fish curry',
  price: 1150,
  image_url: '',
  vegetarian: false,
  vegan: false,
  halal: true,
  spice: 2,
};
const review = {
  restaurant_id: 1,
  body: 'Lovely food',
  food: 5,
  service: 4,
  value: 3,
  ambience: 2,
};
const account = { name: 'Nimal', email: 'nimal@example.com', password: 'correct horse battery' };

describe('restaurantSchema', () => {
  it('accepts a complete restaurant and leaves owner_id optional', () => {
    const result = restaurantSchema.parse(restaurant);
    expect(result).toEqual(restaurant);
    expect(result).not.toHaveProperty('owner_id');
  });

  it('trims text fields before checking their length', () => {
    const result = restaurantSchema.parse({ ...restaurant, name: '  Ab  ' });
    expect(result.name).toBe('Ab');
    expect(restaurantSchema.safeParse({ ...restaurant, name: '  A  ' }).success).toBe(false);
  });

  it.each([
    ['name', 1, false],
    ['name', 2, true],
    ['name', 120, true],
    ['name', 121, false],
    ['address', 1, false],
    ['address', 300, true],
    ['address', 301, false],
    ['description', 1, false],
    ['description', 2000, true],
    ['description', 2001, false],
  ])('%s of %i characters is valid: %s', (field, length, ok) => {
    expect(restaurantSchema.safeParse({ ...restaurant, [field]: 'x'.repeat(length) }).success).toBe(
      ok,
    );
  });

  it.each(['Colombo', 'Kandy', 'Galle'])('accepts the supported city %s', (city) => {
    expect(restaurantSchema.safeParse({ ...restaurant, city }).success).toBe(true);
  });

  it.each(['Jaffna', 'colombo', ''])('rejects the unsupported city %j', (city) => {
    expect(restaurantSchema.safeParse({ ...restaurant, city }).success).toBe(false);
  });

  it.each([
    [null, true],
    [undefined, true],
    [1, true],
    [0, false],
    [-1, false],
    [1.5, false],
    ['1', false],
  ])('owner_id %j is valid: %s', (owner_id, ok) => {
    expect(restaurantSchema.safeParse({ ...restaurant, owner_id }).success).toBe(ok);
  });

  it.each([
    '',
    '/images/fish-curry.jpg',
    '/images/a-1.jpeg',
    '/images/x.png',
    '/images/x.webp',
    'https://example.com/photo.jpg',
    'https://example.com/' + 'a'.repeat(2000 - 'https://example.com/'.length),
  ])('accepts the image URL %j', (image_url) => {
    expect(restaurantSchema.safeParse({ ...restaurant, image_url }).success).toBe(true);
  });

  it.each([
    '/images/../.env',
    '/images/Fish.jpg',
    '/images/x.svg',
    '/images/x.gif',
    '/images/sub/x.jpg',
    '/public/images/x.jpg',
    '//example.com/x.jpg',
    'http://example.com/x.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://example.com/' + 'a'.repeat(2001 - 'https://example.com/'.length),
  ])('rejects the image URL %j', (image_url) => {
    expect(restaurantSchema.safeParse({ ...restaurant, image_url }).success).toBe(false);
  });

  it('requires image_url to be present', () => {
    const { image_url: _, ...rest } = restaurant;
    expect(restaurantSchema.safeParse(rest).success).toBe(false);
  });
});

describe('menuSchema', () => {
  it('defaults the Sinhala and Tamil names to empty strings', () => {
    const result = menuSchema.parse(dish);
    expect(result.name_si).toBe('');
    expect(result.name_ta).toBe('');
  });

  it('trims translated names and caps them at 160 characters', () => {
    expect(menuSchema.parse({ ...dish, name_si: '  මාළු  ' }).name_si).toBe('මාළු');
    expect(menuSchema.safeParse({ ...dish, name_ta: 'x'.repeat(160) }).success).toBe(true);
    expect(menuSchema.safeParse({ ...dish, name_ta: 'x'.repeat(161) }).success).toBe(false);
  });

  it.each([
    [0.01, true],
    [19.99, true],
    [0.1 + 0.2, true],
    [1150, true],
    [999999.99, true],
    [1000000, true],
    [1000000.01, false],
    [0, false],
    [-5, false],
    [0.001, false],
    [10.555, false],
    [Number.NaN, false],
  ])('price %d is valid: %s', (price, ok) => {
    expect(menuSchema.safeParse({ ...dish, price }).success).toBe(ok);
  });

  it('explains when a price has too many decimal places', () => {
    const result = menuSchema.safeParse({ ...dish, price: 0.001 });
    expect(result.error?.issues[0].message).toBe('Use at most two decimal places');
  });

  it.each([
    [0, true],
    [3, true],
    [-1, false],
    [4, false],
    [1.5, false],
  ])('spice level %d is valid: %s', (spice, ok) => {
    expect(menuSchema.safeParse({ ...dish, spice }).success).toBe(ok);
  });

  it.each([
    [false, false, true],
    [true, false, true],
    [true, true, true],
    [false, true, false],
  ])('vegetarian=%s vegan=%s is valid: %s', (vegetarian, vegan, ok) => {
    const result = menuSchema.safeParse({ ...dish, vegetarian, vegan });
    expect(result.success).toBe(ok);
    if (!ok) expect(result.error?.issues[0].message).toBe('Vegan dishes must also be vegetarian');
  });

  it.each(['restaurant_id', 'category_id'])('requires a positive integer %s', (field) => {
    expect(menuSchema.safeParse({ ...dish, [field]: 0 }).success).toBe(false);
    expect(menuSchema.safeParse({ ...dish, [field]: '1' }).success).toBe(false);
  });

  it('applies the shared image rules', () => {
    expect(menuSchema.safeParse({ ...dish, image_url: '/images/x.jpg' }).success).toBe(true);
    expect(menuSchema.safeParse({ ...dish, image_url: 'http://x.com/a.jpg' }).success).toBe(false);
  });
});

describe('reviewSchema', () => {
  it('defaults menu_item_id to null for a restaurant review', () => {
    expect(reviewSchema.parse(review).menu_item_id).toBeNull();
  });

  it('accepts a dish review with a positive menu_item_id', () => {
    expect(reviewSchema.parse({ ...review, menu_item_id: 7 }).menu_item_id).toBe(7);
    expect(reviewSchema.safeParse({ ...review, menu_item_id: 0 }).success).toBe(false);
  });

  it.each(['food', 'service', 'value', 'ambience'])(
    'requires %s to be a whole rating from 1 to 5',
    (field) => {
      for (const ok of [1, 5])
        expect(reviewSchema.safeParse({ ...review, [field]: ok }).success).toBe(true);
      for (const bad of [0, 6, 2.5, '3', undefined])
        expect(reviewSchema.safeParse({ ...review, [field]: bad }).success).toBe(false);
    },
  );

  it.each([
    ['abcd', false],
    ['   abcd   ', false],
    ['abcde', true],
    ['x'.repeat(4000), true],
    ['x'.repeat(4001), false],
  ])('body %j is valid: %s', (body, ok) => {
    expect(reviewSchema.safeParse({ ...review, body }).success).toBe(ok);
  });

  it('stores the trimmed body', () => {
    expect(reviewSchema.parse({ ...review, body: '  Great hoppers  ' }).body).toBe('Great hoppers');
  });
});

describe('replySchema', () => {
  it.each(['comment', 'response'])('accepts a %s reply', (kind) => {
    expect(replySchema.safeParse({ body: 'Thank you!', kind }).success).toBe(true);
  });

  it.each([
    [{ body: 'Thank you!', kind: 'review' }],
    [{ body: 'Thx', kind: 'comment' }],
    [{ body: 'x'.repeat(4001), kind: 'comment' }],
    [{ body: 'Thank you!' }],
  ])('rejects %j', (input) => {
    expect(replySchema.safeParse(input).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('lowercases the email address', () => {
    expect(registerSchema.parse({ ...account, email: 'Nimal@Example.COM' }).email).toBe(
      'nimal@example.com',
    );
  });

  it.each(['not-an-email', 'a@', '@example.com', ''])('rejects the email %j', (email) => {
    expect(registerSchema.safeParse({ ...account, email }).success).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    const email =
      'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(63) + '.com';
    expect(email.length).toBeGreaterThan(254);
    expect(registerSchema.safeParse({ ...account, email }).success).toBe(false);
  });

  it.each([
    ['x'.repeat(11), false],
    ['x'.repeat(12), true],
    ['x'.repeat(72), true],
    ['x'.repeat(73), false],
    ['අ'.repeat(24), true],
    ['අ'.repeat(30), false],
  ])('password %j is valid: %s', (password, ok) => {
    expect(registerSchema.safeParse({ ...account, password }).success).toBe(ok);
  });

  it('explains that a multibyte password exceeds the bcrypt byte limit', () => {
    const password = 'අ'.repeat(30);
    expect(password.length).toBeLessThanOrEqual(72);
    expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);
    const result = registerSchema.safeParse({ ...account, password });
    expect(result.error?.issues[0].message).toBe('Password must fit in 72 UTF-8 bytes');
  });

  it.each([
    ['A', false],
    ['  A  ', false],
    ['Al', true],
    ['x'.repeat(80), true],
    ['x'.repeat(81), false],
  ])('name %j is valid: %s', (name, ok) => {
    expect(registerSchema.safeParse({ ...account, name }).success).toBe(ok);
  });
});

describe('loginSchema', () => {
  it('lowercases the email address', () => {
    expect(loginSchema.parse({ email: 'A@B.CO', password: 'x' }).email).toBe('a@b.co');
  });

  it.each([
    ['', false],
    ['x', true],
    ['x'.repeat(72), true],
    ['x'.repeat(73), false],
    ['අ'.repeat(30), false],
  ])('password %j is valid: %s', (password, ok) => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password }).success).toBe(ok);
  });

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('moderationSchema', () => {
  it('approves without a reason and defaults the reason to an empty string', () => {
    expect(moderationSchema.parse({ status: 'approved' })).toEqual({
      status: 'approved',
      reason: '',
    });
  });

  it.each([
    [undefined, false],
    ['', false],
    ['abcd', false],
    ['   abcd   ', false],
    ['abcde', true],
    ['x'.repeat(500), true],
    ['x'.repeat(501), false],
  ])('rejection reason %j is valid: %s', (reason, ok) => {
    const result = moderationSchema.safeParse({ status: 'rejected', reason });
    expect(result.success).toBe(ok);
  });

  it('trims the reason and explains a missing rejection reason', () => {
    expect(moderationSchema.parse({ status: 'rejected', reason: '  Spam link  ' }).reason).toBe(
      'Spam link',
    );
    expect(moderationSchema.safeParse({ status: 'rejected' }).error?.issues[0].message).toBe(
      'Include a reason when rejecting a posting',
    );
  });

  it.each(['pending', 'deleted', ''])('rejects the status %j', (status) => {
    expect(moderationSchema.safeParse({ status }).success).toBe(false);
  });
});

describe('filtersSchema', () => {
  it('defaults an empty query to recommended sort with no search text', () => {
    expect(filtersSchema.parse({})).toEqual({ q: '', sort: 'recommended' });
  });

  it('trims the search text and caps it at 150 characters', () => {
    expect(filtersSchema.parse({ q: '  kottu  ' }).q).toBe('kottu');
    expect(filtersSchema.safeParse({ q: 'x'.repeat(150) }).success).toBe(true);
    expect(filtersSchema.safeParse({ q: 'x'.repeat(151) }).success).toBe(false);
  });

  it('accepts every supported filter together', () => {
    const input = {
      q: 'curry',
      city: 'Kandy',
      category: 'rice-and-curry',
      vegetarian: 'true',
      vegan: 'true',
      halal: 'true',
      spice: '3',
      band: 'premium',
      sort: 'price-high',
    };
    expect(filtersSchema.parse(input)).toEqual(input);
  });

  it.each([
    ['city', 'Jaffna'],
    ['vegetarian', 'false'],
    ['vegan', '1'],
    ['halal', 'yes'],
    ['spice', '4'],
    ['spice', '-1'],
    ['band', 'luxury'],
    ['sort', 'newest'],
    ['category', 'x'.repeat(81)],
  ])('rejects %s=%j', (field, value) => {
    expect(filtersSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it.each(['recommended', 'rating', 'price-low', 'price-high', 'name'])(
    'accepts the sort order %s',
    (sort) => {
      expect(filtersSchema.parse({ sort }).sort).toBe(sort);
    },
  );
});
