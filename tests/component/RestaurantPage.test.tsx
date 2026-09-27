import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RestaurantPage from '../../src/RestaurantPage';
import type { Detail, User } from '../../src/types';
import {
  bodyOf,
  callsTo,
  makeDetail,
  makeDish,
  makePosting,
  makeRestaurant,
  makeUser,
  mockFetch,
} from './helpers';

const auth = vi.hoisted(() => ({
  user: null as User | null,
  loading: false,
  refresh: async () => {},
}));
vi.mock('../../src/App', () => ({ useAuth: () => auth }));

const detail = (overrides: Partial<Detail> = {}) =>
  makeDetail({
    menu: [makeDish({ id: 11, name: 'Chicken Kottu' }), makeDish({ id: 12, name: 'Crab Curry' })],
    ...overrides,
  });

function renderPage(path = '/restaurants/1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/restaurants/:id" element={<RestaurantPage />} />
        <Route path="/account" element={<h1>Account page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openReviewForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
  return screen.getByRole('dialog', { name: 'Share your experience' });
}

async function rateAll(dialog: HTMLElement, stars: Record<string, number>) {
  for (const [label, n] of Object.entries(stars))
    await userEvent.click(
      within(dialog).getByRole('radio', { name: `${label}: ${n} ${n === 1 ? 'star' : 'stars'}` }),
    );
}

const fullRating = { 'Food quality': 5, 'Customer service': 4, 'Value for money': 3, Ambience: 1 };

beforeEach(() => {
  auth.user = makeUser();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestaurantPage details', () => {
  it('shows a loading status and then the restaurant and its menu', async () => {
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Setting your table…');
    expect(await screen.findByRole('heading', { name: 'Lagoon Table', level: 1 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Chicken Kottu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crab Curry' })).toBeInTheDocument();
    expect(screen.getByText('Mid-range')).toBeInTheDocument();
  });

  it('shows the server error with a way back when the restaurant cannot be loaded', async () => {
    mockFetch({
      'GET /api/restaurants/1': { status: 404, body: { error: 'Restaurant not found.' } },
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Restaurant not found.');
    expect(screen.getByRole('link', { name: 'Back to exploring' })).toHaveAttribute('href', '/');
  });

  it('shows approved reviews with their four aspect scores on the reviews tab', async () => {
    mockFetch({
      'GET /api/restaurants/1': {
        body: detail({
          restaurant: makeRestaurant({ review_count: 1, rating: '4.0' }),
          reviews: [
            makePosting({ id: 5, body: 'Superb devilled prawns.' }),
            makePosting({
              id: 6,
              kind: 'response',
              parent_id: 5,
              author: 'Lagoon Table',
              body: 'Thanks for visiting!',
            }),
          ],
        }),
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Community reviews/ }));
    const review = screen.getByRole('article');
    expect(within(review).getByText('Superb devilled prawns.')).toBeInTheDocument();
    expect(
      within(review).getByText(/Food 5\/5 · Service 4\/5 · Value 4\/5 · Ambience 3\/5/),
    ).toBeInTheDocument();
    expect(within(review).getByText('Thanks for visiting!')).toBeInTheDocument();
    expect(within(review).getByText('Company response')).toHaveClass('company-label');
    expect(within(review).queryByRole('button', { name: /Company response/ })).toBeNull();
  });

  it('lets the restaurant owner write a company response', async () => {
    auth.user = makeUser({ id: 99, role: 'owner' });
    mockFetch({
      'GET /api/restaurants/1': { body: detail({ reviews: [makePosting({ id: 5 })] }) },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Community reviews/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Company response' }));
    expect(screen.getByRole('dialog', { name: 'Company response' })).toBeInTheDocument();
  });
});

describe('RestaurantPage review form', () => {
  it('asks a signed-out visitor to sign in and links back to this restaurant', async () => {
    auth.user = null;
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    const dialog = await openReviewForm();
    expect(within(dialog).getByText('Sign in to contribute to the conversation.')).toBeVisible();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account?next=%2Frestaurants%2F1',
    );
  });

  it('offers five star radios for each of the four aspects', async () => {
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    const dialog = await openReviewForm();
    for (const aspect of ['Food quality', 'Customer service', 'Value for money', 'Ambience']) {
      const group = within(dialog).getByRole('group', { name: aspect });
      expect(within(group).getAllByRole('radio')).toHaveLength(5);
      expect(within(group).getByRole('radio', { name: `${aspect}: 1 star` })).toBeRequired();
    }
    expect(within(dialog).getByRole('combobox', { name: 'What did you try?' })).toHaveValue('');
  });

  it('fills the stars up to the chosen rating', async () => {
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    const dialog = await openReviewForm();
    const three = within(dialog).getByRole('radio', { name: 'Food quality: 3 stars' });
    await userEvent.click(three);
    expect(three).toBeChecked();
    const labels = within(dialog)
      .getAllByRole('radio', { name: /^Food quality/ })
      .map((radio) => radio.closest('label')!.className);
    expect(labels).toEqual(['filled', 'filled', 'filled', '', '']);
  });

  it('does not submit until every aspect is rated', async () => {
    const fetchMock = mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    const dialog = await openReviewForm();
    await rateAll(dialog, { 'Food quality': 4 });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Your review' }), 'Tasty!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    expect(callsTo(fetchMock, 'POST', '/api/reviews')).toHaveLength(0);
  });

  it('submits the ratings, review text and selected dish, then confirms it awaits approval', async () => {
    const fetchMock = mockFetch({
      'GET /api/restaurants/1': { body: detail() },
      'POST /api/reviews': { status: 201, body: { id: 500 } },
    });
    renderPage();
    const dialog = await openReviewForm();
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'What did you try?' }),
      'Crab Curry',
    );
    await rateAll(dialog, fullRating);
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Your review' }),
      'Rich, fiery crab curry.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Thank you! Your contribution is awaiting moderator approval.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/reviews')[0])).toEqual({
      restaurant_id: 1,
      menu_item_id: 12,
      body: 'Rich, fiery crab curry.',
      food: 5,
      service: 4,
      value: 3,
      ambience: 1,
    });
  });

  it('sends a null dish for a review of the overall restaurant experience', async () => {
    const fetchMock = mockFetch({
      'GET /api/restaurants/1': { body: detail() },
      'POST /api/reviews': { status: 201, body: {} },
    });
    renderPage();
    const dialog = await openReviewForm();
    await rateAll(dialog, fullRating);
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Your review' }), 'Good.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    await screen.findByRole('status');
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/reviews')[0]).menu_item_id).toBeNull();
  });

  it('preselects the dish when reviewing from a menu item', async () => {
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    const [, crab] = await screen.findAllByRole('button', { name: /Review dish/ });
    await userEvent.click(crab);
    const dialog = screen.getByRole('dialog', { name: 'Share your experience' });
    expect(within(dialog).getByRole('combobox', { name: 'What did you try?' })).toHaveValue('12');
  });

  it('keeps the form open and shows the server error when submission fails', async () => {
    mockFetch({
      'GET /api/restaurants/1': { body: detail() },
      'POST /api/reviews': { status: 409, body: { error: 'You have already reviewed this.' } },
    });
    renderPage();
    const dialog = await openReviewForm();
    await rateAll(dialog, fullRating);
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Your review' }), 'Again!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You have already reviewed this.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
    expect(screen.queryByText(/awaiting moderator approval/)).not.toBeInTheDocument();
  });

  it('resets the star ratings when the form is reopened', async () => {
    mockFetch({ 'GET /api/restaurants/1': { body: detail() } });
    renderPage();
    let dialog = await openReviewForm();
    await rateAll(dialog, { 'Food quality': 4 });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    dialog = await openReviewForm();
    expect(within(dialog).getByRole('radio', { name: 'Food quality: 4 stars' })).not.toBeChecked();
  });

  it('posts a comment reply to the parent review', async () => {
    const fetchMock = mockFetch({
      'GET /api/restaurants/1': { body: detail({ reviews: [makePosting({ id: 5 })] }) },
      'POST /api/reviews/5/replies': { status: 201, body: {} },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Community reviews/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    const dialog = screen.getByRole('dialog', { name: 'Join the conversation' });
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Your message' }), 'Agreed!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    await screen.findByText(/awaiting moderator approval/);
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/reviews/5/replies')[0])).toEqual({
      kind: 'comment',
      body: 'Agreed!',
    });
  });
});
