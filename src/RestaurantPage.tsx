import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, PenLine, Star, MessageSquare, ShieldCheck } from 'lucide-react';
import { api, money, send } from './api';
import { useAuth } from './App';
import type { Detail, Posting } from './types';
import { DietTags, FoodImage, Message, Modal, Rating } from './components';
export default function RestaurantPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('menu');
  const [compose, setCompose] = useState<{
    kind: 'review' | 'comment' | 'response';
    dish?: number;
    parent?: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({
    food: 0,
    service: 0,
    value: 0,
    ambience: 0,
  });
  useEffect(() => {
    setData(null);
    setError('');
    api<Detail>(`/restaurants/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (data && params.get('dish'))
      document.getElementById(`dish-${params.get('dish')}`)?.scrollIntoView({ block: 'center' });
  }, [data, params]);
  function open(value: NonNullable<typeof compose>) {
    setCompose(value);
    setFormError('');
    setScores({ food: 0, service: 0, value: 0, ambience: 0 });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      if (compose?.kind === 'review') {
        if (Object.values(scores).some((n) => !n))
          throw new Error('Please rate all four aspects of your visit.');
        await api(
          '/reviews',
          send('POST', {
            restaurant_id: Number(id),
            menu_item_id: form.get('menu_item_id') ? Number(form.get('menu_item_id')) : null,
            body: form.get('body'),
            ...scores,
          }),
        );
      } else
        await api(
          `/reviews/${compose?.parent}/replies`,
          send('POST', { kind: compose?.kind, body: form.get('body') }),
        );
      setCompose(null);
      setSuccess(
        'Thank you! Your contribution is awaiting moderator approval. Track it in My contributions.',
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="page narrow">
        <Message text={error} error />
        <Link to="/">Back to exploring</Link>
      </div>
    );
  if (!data)
    return (
      <div className="page loading" role="status">
        Setting your table…
      </div>
    );
  const { restaurant: r, menu, reviews, breakdown } = data;
  const rootReviews = reviews.filter((p) => p.kind === 'review');
  return (
    <div className="page detail-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> All restaurants
      </Link>
      <div className="restaurant-hero">
        <div>
          <span className="eyebrow">
            <MapPin size={14} />
            {r.city}
          </span>
          <h1>{r.name}</h1>
          <p>{r.description}</p>
          <div className="restaurant-meta">
            <Rating value={r.rating} count={r.review_count} />
            <span>{money(r.avg_price)} average dish</span>
            <span>
              {r.price_band === 'budget'
                ? 'Budget'
                : r.price_band === 'mid'
                  ? 'Mid-range'
                  : r.price_band === 'premium'
                    ? 'Premium'
                    : 'Menu coming soon'}
            </span>
          </div>
          <p className="address">
            <MapPin size={15} />
            {r.address}
          </p>
          <button className="button" onClick={() => open({ kind: 'review' })}>
            <PenLine size={16} /> Write a review
          </button>
        </div>
        <FoodImage src={r.image_url} alt={`Illustrative photograph for ${r.name}`} />
      </div>
      <Message text={success} />
      <div className="detail-layout">
        <section>
          <div className="detail-tabs" role="group" aria-label="Restaurant sections">
            <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
              On the menu <span>{menu.length}</span>
            </button>
            <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>
              Community reviews <span>{r.review_count}</span>
            </button>
          </div>
          {tab === 'menu' ? (
            <>
              <div className="section-intro">
                <h2>A taste of what’s here</h2>
                <p>Individual prices in LKR · Dietary attributes supplied by the restaurant</p>
              </div>
              {menu.length === 0 ? (
                <div className="empty">The menu is being prepared. Check back soon.</div>
              ) : (
                menu.map((d) => (
                  <article
                    id={`dish-${d.id}`}
                    className={`menu-item ${params.get('dish') === String(d.id) ? 'highlighted' : ''}`}
                    key={d.id}
                  >
                    <FoodImage src={d.image_url} alt={`Illustrative photograph for ${d.name}`} />
                    <div className="menu-item-content">
                      <span className="eyebrow">{d.category}</span>
                      <h3>{d.name}</h3>
                      <div className="local-names">
                        <span lang="si">{d.name_si}</span>
                        <span lang="ta">{d.name_ta}</span>
                      </div>
                      <p>{d.description}</p>
                      <DietTags dish={d} />
                      <div className="menu-bottom">
                        <strong>{money(d.price)}</strong>
                        <Rating value={d.rating} count={d.review_count} />
                        <button
                          className="text-button"
                          onClick={() => open({ kind: 'review', dish: d.id })}
                        >
                          Review dish <PenLine size={13} />
                        </button>
                      </div>
                      {reviews.some((p) => p.menu_item_id === d.id) && (
                        <details className="dish-reviews">
                          <summary>Read dish reviews</summary>
                          {reviews
                            .filter((p) => p.menu_item_id === d.id)
                            .map((p) => (
                              <div key={p.id}>
                                <strong>{p.author}</strong>
                                <Rating value={p.food} />
                                <p className="user-text" dir="auto">
                                  {p.body}
                                </p>
                              </div>
                            ))}
                        </details>
                      )}
                    </div>
                  </article>
                ))
              )}
            </>
          ) : (
            <>
              <div className="section-intro">
                <h2>Stories from the table</h2>
                <p>Published after moderator approval. Ratings reflect personal experiences.</p>
              </div>
              {rootReviews.length === 0 ? (
                <div className="empty">
                  <MessageSquare size={32} />
                  <h3>Be the first to share your experience.</h3>
                </div>
              ) : (
                rootReviews.map((p) => (
                  <Review
                    key={p.id}
                    post={p}
                    replies={reviews.filter((reply) => reply.parent_id === p.id)}
                    company={user?.role === 'admin' || user?.id === r.owner_id}
                    onReply={(kind) => open({ kind, parent: p.id })}
                  />
                ))
              )}
            </>
          )}
        </section>
        <aside className="rating-summary">
          <span className="eyebrow">THE TABLE’S VERDICT</span>
          <div className="big-rating">
            {r.rating ? Number(r.rating).toFixed(1) : 'New'}
            <Star fill="currentColor" />
          </div>
          <p>{r.review_count} approved reviews</p>
          {Object.entries(breakdown).map(([key, value]) => (
            <div className="rating-bar" key={key}>
              <div>
                <span>
                  {key === 'food'
                    ? 'Food quality'
                    : key === 'service'
                      ? 'Customer service'
                      : key === 'value'
                        ? 'Value for money'
                        : 'Ambience'}
                </span>
                <strong>{value ? Number(value).toFixed(1) : '—'}</strong>
              </div>
              <div className="bar">
                <span style={{ width: `${Number(value || 0) * 20}%` }} />
              </div>
            </div>
          ))}
          <div className="rating-explanation">
            <ShieldCheck size={18} />
            <p>Four aspects. One shared experience. Each carries equal weight.</p>
          </div>
          <Link className="text-button" to="/how-it-works">
            How ratings work
          </Link>
        </aside>
      </div>
      {compose && (
        <Modal
          title={
            compose.kind === 'review'
              ? 'Share your experience'
              : compose.kind === 'response'
                ? 'Company response'
                : 'Join the conversation'
          }
          onClose={() => {
            if (!busy) setCompose(null);
          }}
        >
          {!user ? (
            <div className="signin-prompt">
              <p>Sign in to contribute to the conversation.</p>
              <Link
                className="button"
                to={`/account?next=${encodeURIComponent(`/restaurants/${id}`)}`}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="muted">{r.name} · All contributions require moderator approval.</p>
              <Message text={formError} error />
              {compose.kind === 'review' && (
                <>
                  <label>
                    What did you try?
                    <select name="menu_item_id" defaultValue={compose.dish || ''}>
                      <option value="">The overall restaurant experience</option>
                      {menu.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="score-fields">
                    {[
                      ['food', 'Food quality'],
                      ['service', 'Customer service'],
                      ['value', 'Value for money'],
                      ['ambience', 'Ambience'],
                    ].map(([key, label]) => (
                      <fieldset className="star-field" key={key}>
                        <legend>{label}</legend>
                        <div>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <label key={n} className={scores[key] >= n ? 'filled' : ''}>
                              <input
                                type="radio"
                                name={key}
                                value={n}
                                required
                                checked={scores[key] === n}
                                onChange={() => setScores({ ...scores, [key]: n })}
                                aria-label={`${label}: ${n} ${n === 1 ? 'star' : 'stars'}`}
                              />
                              <Star size={25} fill={scores[key] >= n ? 'currentColor' : 'none'} />
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </>
              )}
              <label>
                {compose.kind === 'review' ? 'Your review' : 'Your message'}
                <textarea
                  name="body"
                  placeholder="English, සිංහල or தமிழ் — tell us about your experience."
                  minLength={5}
                  maxLength={4000}
                  rows={5}
                  required
                  dir="auto"
                />
              </label>
              <p className="field-hint">
                5–4,000 characters. Please keep contributions relevant and respectful.
              </p>
              <button className="button full" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit for approval'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
function Review({
  post: p,
  replies,
  company,
  onReply,
}: {
  post: Posting;
  replies: Posting[];
  company: boolean;
  onReply: (kind: 'comment' | 'response') => void;
}) {
  return (
    <article className="review">
      <div className="review-header">
        <span className="avatar">{p.author.charAt(0)}</span>
        <div>
          <strong>{p.author}</strong>
          <small>
            {new Date(p.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </small>
        </div>
        <Rating value={(p.food + p.service + p.value + p.ambience) / 4} />
      </div>
      {p.dish_name && <span className="review-dish">Tried {p.dish_name}</span>}
      <p className="user-text" dir="auto">
        {p.body}
      </p>
      <div className="review-scores">
        Food {p.food}/5 · Service {p.service}/5 · Value {p.value}/5 · Ambience {p.ambience}/5
      </div>
      <div className="review-actions">
        <button className="text-button" onClick={() => onReply('comment')}>
          <MessageSquare size={14} /> Comment
        </button>
        {company && (
          <button className="text-button" onClick={() => onReply('response')}>
            <ShieldCheck size={14} /> Company response
          </button>
        )}
      </div>
      {replies.map((reply) => (
        <div className={`reply ${reply.kind === 'response' ? 'company-reply' : ''}`} key={reply.id}>
          <strong>{reply.author}</strong>
          {reply.kind === 'response' && <span className="company-label">Company response</span>}
          <p className="user-text" dir="auto">
            {reply.body}
          </p>
        </div>
      ))}
    </article>
  );
}
