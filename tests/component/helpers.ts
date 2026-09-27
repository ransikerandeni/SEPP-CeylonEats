import { vi } from 'vitest';
import type { Detail, Dish, Posting, Restaurant, User } from '../../src/types';

export type Route = { status?: number; body?: unknown };
type Handler = (url: string, init: RequestInit) => Route;

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stubs global fetch; `routes` maps "METHOD /path" (path without query) to a response. */
export function mockFetch(routes: Record<string, Route | Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const key = `${init.method ?? 'GET'} ${url.split('?')[0]}`;
    const route = routes[key];
    if (!route) return json({ error: `Unmocked ${key}` }, 500);
    const { status = 200, body = {} } = typeof route === 'function' ? route(url, init) : route;
    return json(body, status);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function callsTo(fetchMock: ReturnType<typeof mockFetch>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && String(url).split('?')[0] === path,
  );
}

export function bodyOf(call: unknown[]) {
  return JSON.parse(String((call[1] as RequestInit).body));
}

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 7,
  name: 'Nimali Perera',
  email: 'nimali@example.com',
  role: 'customer',
  ...overrides,
});

export const makeDish = (overrides: Partial<Dish> = {}): Dish => ({
  id: 11,
  restaurant_id: 1,
  category_id: 2,
  name: 'Chicken Kottu',
  name_si: 'චිකන් කොත්තු',
  name_ta: 'சிக்கன் கொத்து',
  description: 'Chopped godamba roti with chicken curry.',
  price: '1450.00',
  image_url: '/images/kottu.jpg',
  vegetarian: false,
  vegan: false,
  halal: false,
  spice: 0,
  category: 'Kottu',
  category_slug: 'kottu',
  restaurant_name: 'Lagoon Table',
  city: 'Colombo',
  rating: null,
  review_count: 0,
  ...overrides,
});

export const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: 1,
  name: 'Lagoon Table',
  city: 'Colombo',
  address: '12 Galle Road, Colombo 03',
  description: 'Seafood by the lagoon.',
  image_url: '/images/lagoon.jpg',
  owner_id: 99,
  avg_price: '1450.00',
  min_price: '900.00',
  max_price: '2000.00',
  price_band: 'mid',
  menu_count: 1,
  review_count: 0,
  rating: null,
  rank_score: '3.5',
  categories: ['Seafood'],
  ...overrides,
});

export const makePosting = (overrides: Partial<Posting> = {}): Posting => ({
  id: 101,
  author: 'Kasun',
  restaurant_id: 1,
  menu_item_id: null,
  kind: 'review',
  body: 'Lovely crab curry and friendly staff.',
  parent_id: null,
  food: 5,
  service: 4,
  value: 4,
  ambience: 3,
  created_at: '2026-01-15T10:00:00.000Z',
  ...overrides,
});

export const makeDetail = (overrides: Partial<Detail> = {}): Detail => ({
  restaurant: makeRestaurant(),
  menu: [makeDish()],
  reviews: [],
  breakdown: { food: null, service: null, value: null, ambience: null },
  ...overrides,
});
