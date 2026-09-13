CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','owner','moderator','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  city TEXT NOT NULL CHECK (city IN ('Colombo','Kandy','Galle')),
  address TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  name_si TEXT NOT NULL DEFAULT '',
  name_ta TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0 AND price <= 1000000),
  image_url TEXT NOT NULL DEFAULT '',
  vegetarian BOOLEAN NOT NULL DEFAULT false,
  vegan BOOLEAN NOT NULL DEFAULT false,
  halal BOOLEAN NOT NULL DEFAULT false,
  spice INTEGER NOT NULL CHECK (spice BETWEEN 0 AND 3),
  CHECK (NOT vegan OR vegetarian),
  UNIQUE (id, restaurant_id)
);
CREATE TABLE IF NOT EXISTS postings (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  menu_item_id INTEGER,
  parent_id INTEGER REFERENCES postings(id),
  kind TEXT NOT NULL CHECK (kind IN ('review','comment','response')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 4000),
  food INTEGER CHECK (food BETWEEN 1 AND 5),
  service INTEGER CHECK (service BETWEEN 1 AND 5),
  value INTEGER CHECK (value BETWEEN 1 AND 5),
  ambience INTEGER CHECK (ambience BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  moderation_reason TEXT NOT NULL DEFAULT '',
  moderated_by INTEGER REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (menu_item_id, restaurant_id) REFERENCES menu_items(id, restaurant_id),
  CHECK ((kind = 'review' AND parent_id IS NULL AND food IS NOT NULL AND service IS NOT NULL AND value IS NOT NULL AND ambience IS NOT NULL)
      OR (kind IN ('comment','response') AND parent_id IS NOT NULL AND menu_item_id IS NULL AND food IS NULL AND service IS NULL AND value IS NULL AND ambience IS NULL))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_restaurant_idx ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS postings_public_idx ON postings(restaurant_id, status, kind);
CREATE INDEX IF NOT EXISTS postings_parent_idx ON postings(parent_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE OR REPLACE VIEW restaurant_stats AS
SELECT r.*,
  m.avg_price, m.min_price, m.max_price, COALESCE(m.menu_count,0)::integer AS menu_count,
  CASE WHEN m.avg_price IS NULL THEN 'unpriced' WHEN m.avg_price < 1000 THEN 'budget' WHEN m.avg_price <= 2500 THEN 'mid' ELSE 'premium' END AS price_band,
  COALESCE(p.review_count,0)::integer AS review_count, p.rating,
  (COALESCE(p.rating,0)*COALESCE(p.review_count,0)+3.5*5)/(COALESCE(p.review_count,0)+5) AS rank_score
FROM restaurants r
LEFT JOIN LATERAL (SELECT ROUND(AVG(price),2) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price, COUNT(*) AS menu_count FROM menu_items WHERE restaurant_id=r.id) m ON true
LEFT JOIN LATERAL (SELECT COUNT(*) AS review_count, AVG((food+service+value+ambience)/4.0) AS rating FROM postings WHERE restaurant_id=r.id AND kind='review' AND status='approved') p ON true;
CREATE OR REPLACE VIEW menu_stats AS
SELECT m.*, c.name AS category, c.slug AS category_slug, r.name AS restaurant_name, r.city,
 COALESCE(p.review_count,0)::integer AS review_count, p.rating,
 (COALESCE(p.rating,0)*COALESCE(p.review_count,0)+3.5*5)/(COALESCE(p.review_count,0)+5) AS rank_score
FROM menu_items m JOIN categories c ON c.id=m.category_id JOIN restaurants r ON r.id=m.restaurant_id
LEFT JOIN LATERAL (SELECT COUNT(*) AS review_count, AVG(food) AS rating FROM postings WHERE menu_item_id=m.id AND kind='review' AND status='approved') p ON true;
