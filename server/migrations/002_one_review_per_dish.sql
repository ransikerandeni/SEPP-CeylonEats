-- One review per dish, plus one for the restaurant overall. Rejected reviews are excluded
-- so their author can rewrite them.
CREATE UNIQUE INDEX IF NOT EXISTS postings_one_review_per_subject
  ON postings (author_id, restaurant_id, menu_item_id) NULLS NOT DISTINCT
  WHERE kind = 'review' AND status <> 'rejected';
