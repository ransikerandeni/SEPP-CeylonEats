import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  ArrowUpRight,
  SlidersHorizontal,
  Utensils,
  Soup,
  Flame,
  Sandwich,
  Fish,
  CookingPot,
  Wheat,
  Beef,
  Leaf,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, money, spiceNames } from './api';
import type { Category, Dish, Restaurant } from './types';
import { DietTags, FoodImage, Message, Rating } from './components';
const categoryIcons = [Soup, Flame, Sandwich, CookingPot, Fish, Wheat, CookingPot, Beef];
const heroImage = '/images/village-rice-curry.jpg';
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<{ restaurants: Restaurant[]; dishes: Dish[] }>({
    restaurants: [],
    dishes: [],
  });
  const [query, setQuery] = useState(params.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tab = params.get('view') === 'dishes' ? 'dishes' : 'restaurants';
  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params.get('q')]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const search = new URLSearchParams(params);
    search.delete('view');
    api<typeof data>('/explore?' + search, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [params.toString()]);
  function change(key: string, value: string) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      value ? n.set(key, value) : n.delete(key);
      return n;
    });
  }
  const activeCount = ['city', 'band', 'vegetarian', 'vegan', 'halal', 'spice'].filter((k) =>
    params.has(k),
  ).length;
  const count = data[tab].length;
  return (
    <div className="explore-page">
      <section className="discovery-banner">
        <div className="banner-copy">
          <span className="eyebrow">
            <span className="tiny-line" />A little local. A lot to discover.
          </span>
          <h1>
            Good food.
            <br />
            <em>Great discoveries.</em>
          </h1>
          <p>
            Your next favourite table is closer than you think.
            <br className="desktop" /> Explore local flavours, one honest review at a time.
          </p>
          <div className="city-line">
            <MapPin size={15} /> Colombo <span>·</span> Kandy <span>·</span> Galle
          </div>
        </div>
        <div className="banner-photo">
          <FoodImage src={heroImage} alt="A colourful Sri Lankan rice and curry meal" />
          <div className="photo-caption">
            <span>Savour the island</span>
            <strong>Made of many flavours.</strong>
          </div>
        </div>
      </section>
      <section className="search-area" aria-label="Search restaurants and dishes">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            change('q', query);
          }}
        >
          <Search size={21} />
          <input
            aria-label="Search restaurants or dishes"
            placeholder="A restaurant, a dish, a new favourite…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="search-divider" />
          <MapPin size={19} />
          <select
            aria-label="Search city"
            value={params.get('city') || ''}
            onChange={(e) => change('city', e.target.value)}
          >
            <option value="">All three cities</option>
            {['Colombo', 'Kandy', 'Galle'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="button" type="submit">
            Find my flavour <Search size={17} />
          </button>
        </form>
        <p className="search-note">Search in English, සිංහල or தமிழ்</p>
      </section>
      <section className="category-strip" aria-label="Browse categories">
        <button
          className={!params.get('category') ? 'selected' : ''}
          onClick={() => change('category', '')}
        >
          <Utensils />
          <span>All flavours</span>
        </button>
        {categories.map((c, i) => {
          const Icon = categoryIcons[i] || Utensils;
          return (
            <button
              key={c.id}
              className={params.get('category') === c.slug ? 'selected' : ''}
              onClick={() => change('category', params.get('category') === c.slug ? '' : c.slug)}
            >
              <Icon />
              <span>{c.name}</span>
            </button>
          );
        })}
      </section>
      <section className="results-layout">
        <aside className={filtersOpen ? 'filters mobile-open' : 'filters'}>
          <div className="filter-title">
            <h2>
              <SlidersHorizontal size={18} /> Make it yours
            </h2>
            <button
              onClick={() => {
                setParams(
                  (p) => new URLSearchParams(p.get('view') ? { view: p.get('view')! } : {}),
                );
                setQuery('');
              }}
              className="text-button"
            >
              Reset
            </button>
          </div>
          <fieldset>
            <legend>YOUR BUDGET</legend>
            <p className="field-hint">Average menu item price</p>
            {[
              ['', 'Any price'],
              ['budget', 'Below LKR 1,000'],
              ['mid', 'LKR 1,000–2,500'],
              ['premium', 'Above LKR 2,500'],
            ].map(([v, l]) => (
              <label className="choice" key={v}>
                <input
                  type="radio"
                  name="band"
                  value={v}
                  checked={(params.get('band') || '') === v}
                  onChange={() => change('band', v)}
                />
                {l}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>AT YOUR TABLE</legend>
            {[
              ['vegetarian', 'Vegetarian'],
              ['vegan', 'Vegan'],
              ['halal', 'Halal'],
            ].map(([key, label]) => (
              <label className="choice" key={key}>
                <input
                  type="checkbox"
                  checked={params.has(key)}
                  onChange={(e) => change(key, e.target.checked ? 'true' : '')}
                />
                {label}
                {key === 'halal' ? <ShieldCheck size={15} /> : <Leaf size={15} />}
              </label>
            ))}
            <p className="field-hint">Preferences match a single dish.</p>
          </fieldset>
          <fieldset>
            <legend>A LITTLE HEAT?</legend>
            <label className="sr-only" htmlFor="spice-filter">
              Spice level
            </label>
            <select
              id="spice-filter"
              value={params.get('spice') ?? ''}
              onChange={(e) => change('spice', e.target.value)}
            >
              <option value="">Any spice level</option>
              {spiceNames.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </fieldset>
          <div className="trust-note">
            <ShieldCheck size={24} />
            <strong>Good food. Honest voices.</strong>
            <p>Every review is checked by our moderators before it reaches your table.</p>
            <Link to="/how-it-works">
              Our review approach <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
        <div className="results">
          <div className="results-heading">
            <div>
              <span className="eyebrow">THE LOCAL LIST</span>
              <h2>
                {params.get('city')
                  ? `A taste of ${params.get('city')}`
                  : 'Find a table you’ll love'}
              </h2>
            </div>
            <button
              className="filter-toggle button outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={17} /> Filters {activeCount > 0 && `(${activeCount})`}
            </button>
          </div>
          <div className="results-toolbar">
            <div className="view-tabs" role="group" aria-label="Result type">
              <button
                className={tab === 'restaurants' ? 'active' : ''}
                onClick={() => change('view', 'restaurants')}
              >
                Restaurants <span>{data.restaurants.length}</span>
              </button>
              <button
                className={tab === 'dishes' ? 'active' : ''}
                onClick={() => change('view', 'dishes')}
              >
                Dishes <span>{data.dishes.length}</span>
              </button>
            </div>
            <label className="sort-label">
              Sort by{' '}
              <select
                aria-label="Sort results"
                value={params.get('sort') || 'recommended'}
                onChange={(e) => change('sort', e.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>
          {params.get('q') && (
            <div className="query-chip">
              Results for “{params.get('q')}”
              <button
                aria-label="Clear search"
                className="icon-button"
                onClick={() => change('q', '')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <Message text={error} error />
          {loading ? (
            <div className="loading" role="status">
              Finding something delicious…
            </div>
          ) : !error && count === 0 ? (
            <div className="empty">
              <Search size={34} />
              <h3>No matches on the menu.</h3>
              <p>Try another dish, city, or a few fewer filters.</p>
              <button className="button outline" onClick={() => setParams({ view: tab })}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className="result-count" aria-live="polite">
                {count} {tab} to explore
                {params.get('category') &&
                  ` · ${categories.find((c) => c.slug === params.get('category'))?.name || ''}`}
              </p>
              <div className="card-grid">
                {tab === 'restaurants'
                  ? data.restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)
                  : data.dishes.map((d) => <DishCard key={d.id} dish={d} />)}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  return (
    <Link className="restaurant-card" to={`/restaurants/${r.id}`}>
      <div className="card-image">
        <FoodImage src={r.image_url} alt={`Illustrative dining photograph for ${r.name}`} />
        <span className="city-badge">
          <MapPin size={12} />
          {r.city}
        </span>
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3>{r.name}</h3>
          <Rating value={r.rating} />
        </div>
        <p className="card-categories">
          {r.categories?.slice(0, 2).join(' · ') || 'Menu coming soon'}
        </p>
        <p className="card-description">{r.description}</p>
        <div className="card-bottom">
          <span>
            <strong>{money(r.avg_price)}</strong>
            <small>average dish</small>
          </span>
          <span className="review-count">
            {r.review_count} reviews <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}
function DishCard({ dish: d }: { dish: Dish }) {
  return (
    <Link className="restaurant-card dish-card" to={`/restaurants/${d.restaurant_id}?dish=${d.id}`}>
      <div className="card-image">
        <FoodImage src={d.image_url} alt={`Illustrative photograph for ${d.name}`} />
        <span className="city-badge">{d.category}</span>
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3>{d.name}</h3>
          <Rating value={d.rating} />
        </div>
        <p className="card-categories">
          {d.restaurant_name} · {d.city}
        </p>
        <div className="local-names">
          <span lang="si">{d.name_si}</span>
          <span lang="ta">{d.name_ta}</span>
        </div>
        <DietTags dish={d} />
        <div className="card-bottom">
          <strong>{money(d.price)}</strong>
          <span className="review-count">
            View dish <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}
