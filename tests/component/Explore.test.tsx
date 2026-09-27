import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Explore from '../../src/Explore';
import type { Dish, Restaurant } from '../../src/types';
import { makeDish, makeRestaurant, mockFetch } from './helpers';

const categories = [
  { id: 1, name: 'Rice & Curry', slug: 'rice-curry' },
  { id: 2, name: 'Kottu', slug: 'kottu' },
];

function LocationProbe() {
  const { search } = useLocation();
  return <output aria-label="Current search">{search}</output>;
}

function setup(
  path = '/',
  results: { restaurants?: Restaurant[]; dishes?: Dish[] } = {
    restaurants: [makeRestaurant()],
    dishes: [makeDish()],
  },
) {
  const fetchMock = mockFetch({
    'GET /api/categories': { body: categories },
    'GET /api/explore': { body: { restaurants: [], dishes: [], ...results } },
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Explore />
      <LocationProbe />
    </MemoryRouter>,
  );
  const exploreQueries = () =>
    fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith('/api/explore'))
      .map((url) => new URLSearchParams(url.split('?')[1]));
  const lastQuery = () => exploreQueries().at(-1)!;
  return { fetchMock, exploreQueries, lastQuery };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Explore results', () => {
  it('loads restaurants with no filters and shows how many were found', async () => {
    const { lastQuery } = setup();
    expect(screen.getByText('Finding something delicious…')).toHaveAttribute('role', 'status');
    expect(await screen.findByText('1 restaurants to explore')).toBeInTheDocument();
    expect(lastQuery().toString()).toBe('');
    expect(screen.getByRole('link', { name: /Lagoon Table/ })).toHaveAttribute(
      'href',
      '/restaurants/1',
    );
  });

  it('shows dishes linking to their place on the restaurant menu on the dishes view', async () => {
    const { lastQuery } = setup('/?view=dishes');
    expect(await screen.findByText('1 dishes to explore')).toBeInTheDocument();
    expect(lastQuery().has('view')).toBe(false);
    expect(screen.getByRole('link', { name: /Chicken Kottu/ })).toHaveAttribute(
      'href',
      '/restaurants/1?dish=11',
    );
  });

  it('shows an empty state that clears filters but keeps the current view', async () => {
    setup('/?view=dishes&city=Kandy&vegan=true', { restaurants: [], dishes: [] });
    expect(await screen.findByRole('heading', { name: 'No matches on the menu.' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('status', { name: 'Current search' })).toHaveTextContent(
      /^\?view=dishes$/,
    );
  });

  it('shows the server error instead of the empty state when the search fails', async () => {
    mockFetch({
      'GET /api/categories': { body: categories },
      'GET /api/explore': { status: 500, body: { error: 'Search is unavailable.' } },
    });
    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Search is unavailable.');
    expect(screen.queryByText('No matches on the menu.')).not.toBeInTheDocument();
  });
});

describe('Explore search and filters', () => {
  it('sends the typed search term only when the search is submitted', async () => {
    const { exploreQueries, lastQuery } = setup();
    await screen.findByText(/to explore/);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search restaurants or dishes' }),
      'kottu',
    );
    expect(exploreQueries()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Find my flavour/ }));
    await waitFor(() => expect(lastQuery().get('q')).toBe('kottu'));
    expect(screen.getByText(/Results for “kottu”/)).toBeInTheDocument();
  });

  it('clears the search term from the query and the input with the clear button', async () => {
    const { lastQuery } = setup('/?q=hoppers');
    const input = screen.getByRole('textbox', { name: 'Search restaurants or dishes' });
    expect(input).toHaveValue('hoppers');
    await userEvent.click(await screen.findByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(lastQuery().has('q')).toBe(false));
    expect(input).toHaveValue('');
  });

  it('filters by city and updates the heading', async () => {
    const { lastQuery } = setup();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Search city' }), 'Galle');
    await waitFor(() => expect(lastQuery().get('city')).toBe('Galle'));
    expect(screen.getByRole('heading', { name: 'A taste of Galle' })).toBeInTheDocument();
  });

  it('sends the chosen budget band and drops it again for any price', async () => {
    const { lastQuery } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'LKR 1,000–2,500' }));
    await waitFor(() => expect(lastQuery().get('band')).toBe('mid'));
    expect(screen.getByRole('radio', { name: 'LKR 1,000–2,500' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Any price' }));
    await waitFor(() => expect(lastQuery().has('band')).toBe(false));
  });

  it('toggles dietary preferences as true flags', async () => {
    const { lastQuery } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vegan' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Halal' }));
    await waitFor(() => {
      expect(lastQuery().get('vegan')).toBe('true');
      expect(lastQuery().get('halal')).toBe('true');
    });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vegan' }));
    await waitFor(() => expect(lastQuery().has('vegan')).toBe(false));
    expect(lastQuery().get('halal')).toBe('true');
  });

  it('sends spice level zero for Not spicy rather than dropping it', async () => {
    const { lastQuery } = setup();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Spice level' }),
      'Not spicy',
    );
    await waitFor(() => expect(lastQuery().get('spice')).toBe('0'));
  });

  it('sends the chosen sort order', async () => {
    const { lastQuery } = setup();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort results' }),
      'Price: low to high',
    );
    await waitFor(() => expect(lastQuery().get('sort')).toBe('price-low'));
  });

  it('selects a category and deselects it when pressed again', async () => {
    const { lastQuery } = setup();
    const kottu = await screen.findByRole('button', { name: 'Kottu' });
    await userEvent.click(kottu);
    await waitFor(() => expect(lastQuery().get('category')).toBe('kottu'));
    expect(kottu).toHaveClass('selected');
    expect(await screen.findByText('1 restaurants to explore · Kottu')).toBeInTheDocument();
    await userEvent.click(kottu);
    await waitFor(() => expect(lastQuery().has('category')).toBe(false));
  });

  it('counts active filters on the filter toggle', async () => {
    setup('/?city=Kandy&vegan=true&spice=2&q=curry&category=kottu&sort=name');
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('Filters (3)');
  });

  it('resets every filter and the search box but keeps the current view', async () => {
    const { lastQuery } = setup('/?view=dishes&q=curry&city=Kandy&band=budget&halal=true');
    await screen.findByText(/to explore/);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(lastQuery().toString()).toBe(''));
    expect(screen.getByRole('status', { name: 'Current search' })).toHaveTextContent(
      /^\?view=dishes$/,
    );
    expect(screen.getByRole('textbox', { name: 'Search restaurants or dishes' })).toHaveValue('');
  });

  it('switches between restaurant and dish results without refetching', async () => {
    const { exploreQueries } = setup();
    await screen.findByText('1 restaurants to explore');
    await userEvent.click(screen.getByRole('button', { name: /Dishes/ }));
    expect(await screen.findByText('1 dishes to explore')).toBeInTheDocument();
    expect(exploreQueries().every((q) => !q.has('view'))).toBe(true);
  });
});
