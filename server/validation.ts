import { z } from 'zod';
const text = (max: number, min = 2) => z.string().trim().min(min).max(max);
const image = z.union([
  z.literal(''),
  z.string().regex(/^\/images\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/),
  z
    .url()
    .max(2000)
    .refine((v) => v.startsWith('https://'), 'Use an HTTPS image URL'),
]);
export const restaurantSchema = z.object({
  name: text(120),
  city: z.enum(['Colombo', 'Kandy', 'Galle']),
  address: text(300),
  description: text(2000),
  image_url: image,
  owner_id: z.number().int().positive().nullable().optional(),
});
export const menuSchema = z
  .object({
    restaurant_id: z.number().int().positive(),
    category_id: z.number().int().positive(),
    name: text(160),
    name_si: z.string().trim().max(160).default(''),
    name_ta: z.string().trim().max(160).default(''),
    description: text(2000),
    price: z
      .number()
      .positive()
      .max(1000000)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
        'Use at most two decimal places',
      ),
    image_url: image,
    vegetarian: z.boolean(),
    vegan: z.boolean(),
    halal: z.boolean(),
    spice: z.number().int().min(0).max(3),
  })
  .refine((v) => !v.vegan || v.vegetarian, 'Vegan dishes must also be vegetarian');
const rating = z.number().int().min(1).max(5);
export const reviewSchema = z.object({
  restaurant_id: z.number().int().positive(),
  menu_item_id: z.number().int().positive().nullable().default(null),
  body: text(4000, 5),
  food: rating,
  service: rating,
  value: rating,
  ambience: rating,
});
export const replySchema = z.object({ body: text(4000, 5), kind: z.enum(['comment', 'response']) });
export const registerSchema = z.object({
  name: text(80),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(72)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must fit in 72 UTF-8 bytes'),
});
export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must fit in 72 UTF-8 bytes'),
});
export const moderationSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).default(''),
  })
  .refine(
    (v) => v.status !== 'rejected' || v.reason.length >= 5,
    'Include a reason when rejecting a posting',
  );
export const filtersSchema = z.object({
  q: z.string().trim().max(150).default(''),
  city: z.enum(['Colombo', 'Kandy', 'Galle']).optional(),
  category: z.string().max(80).optional(),
  vegetarian: z.enum(['true']).optional(),
  vegan: z.enum(['true']).optional(),
  halal: z.enum(['true']).optional(),
  spice: z.enum(['0', '1', '2', '3']).optional(),
  band: z.enum(['budget', 'mid', 'premium']).optional(),
  sort: z.enum(['recommended', 'rating', 'price-low', 'price-high', 'name']).default('recommended'),
});
