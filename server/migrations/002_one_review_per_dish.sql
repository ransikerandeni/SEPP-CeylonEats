-- A reviewer gets one review per dish, plus one for the restaurant as a whole
-- (menu_item_id IS NULL). Repeat reviews of the same subject moved the average and the
-- rank_score without adding information. Rejected reviews are excluded so an author can
-- rewrite and resubmit after a moderator turns one down.
CREATE UNIQUE INDEX IF NOT EXISTS postings_one_review_per_subject
  ON postings (author_id, restaurant_id, menu_item_id) NULLS NOT DISTINCT
  WHERE kind = 'review' AND status <> 'rejected';
