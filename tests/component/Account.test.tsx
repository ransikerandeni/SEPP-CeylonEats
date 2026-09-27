import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Account from '../../src/Account';
import type { User } from '../../src/types';
import { bodyOf, callsTo, makePosting, makeUser, mockFetch } from './helpers';

const auth = vi.hoisted(() => ({
  user: null as User | null,
  loading: false,
  refresh: vi.fn(async () => {}),
}));
vi.mock('../../src/App', () => ({ useAuth: () => auth }));

function renderAccount({ path = '/account', contributions = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/my-reviews" element={<Account contributions={contributions} />} />
        <Route path="/" element={<h1>Explore page</h1>} />
        <Route path="/restaurants/:id" element={<h1>Restaurant page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillSignIn(email = 'nimali@example.com', password = 'correct horse') {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

beforeEach(() => {
  auth.user = null;
  auth.loading = false;
  auth.refresh.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Account sign in', () => {
  it('shows a loading message while the session is being checked', () => {
    auth.loading = true;
    mockFetch({});
    renderAccount();
    expect(screen.getByText('Loading your account…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('offers a sign-in form with email and password fields by default', () => {
    mockFetch({});
    renderAccount();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    const email = screen.getByLabelText('Email address');
    const password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toBeRequired();
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toBeRequired();
  });

  it('does not submit while required fields are empty', async () => {
    const fetchMock = mockFetch({});
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email address')).toBeInvalid();
  });

  it('posts the credentials, refreshes the session and returns to explore', async () => {
    const fetchMock = mockFetch({ 'POST /api/auth/login': { body: { user: makeUser() } } });
    renderAccount();
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Explore page' })).toBeInTheDocument();
    const [call] = callsTo(fetchMock, 'POST', '/api/auth/login');
    expect(bodyOf(call)).toEqual({ email: 'nimali@example.com', password: 'correct horse' });
    expect((call[1] as RequestInit).headers).toMatchObject({ 'X-Requested-With': 'CeylonEats' });
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });

  it('returns to a same-site next path after signing in', async () => {
    mockFetch({ 'POST /api/auth/login': { body: {} } });
    renderAccount({ path: '/account?next=%2Frestaurants%2F4' });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Restaurant page' })).toBeInTheDocument();
  });

  it.each(['//evil.example/phish', 'https://evil.example'])(
    'ignores an off-site next path (%s) and returns to explore',
    async (next) => {
      mockFetch({ 'POST /api/auth/login': { body: {} } });
      renderAccount({ path: `/account?next=${encodeURIComponent(next)}` });
      await fillSignIn();
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(await screen.findByRole('heading', { name: 'Explore page' })).toBeInTheDocument();
    },
  );

  it('shows the server error and stays on the form when sign in fails', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 401, body: { error: 'Email or password is incorrect.' } },
    });
    renderAccount();
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows a rate-limit message when the server replies 429 in plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Too many', { status: 429 })),
    );
    renderAccount();
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests. Please wait a moment and try again.',
    );
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    renderAccount();
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    resolve(new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } }));
    expect(await screen.findByRole('heading', { name: 'Explore page' })).toBeInTheDocument();
  });
});

describe('Account registration', () => {
  it('switches to a registration form with a name field and a 12-character password rule', async () => {
    mockFetch({});
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    expect(screen.getByRole('heading', { name: 'Join the table' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeRequired();
    expect(screen.getByLabelText('Your name')).toHaveAttribute('minlength', '2');
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('minlength', '12');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByText(/Use at least 12 characters/)).toBeInTheDocument();
  });

  it('posts name, email and password to the register endpoint', async () => {
    const fetchMock = mockFetch({ 'POST /api/auth/register': { status: 201, body: {} } });
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    await userEvent.type(screen.getByLabelText('Your name'), 'Nimali Perera');
    await fillSignIn('nimali@example.com', 'a long enough passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Explore page' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/auth/login')).toHaveLength(0);
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/auth/register')[0])).toEqual({
      name: 'Nimali Perera',
      email: 'nimali@example.com',
      password: 'a long enough passphrase',
    });
  });

  it('clears a previous error when switching between sign in and registration', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 401, body: { error: 'Nope.' } } });
    renderAccount();
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');

    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('Account when signed in', () => {
  it('greets a signed-in user instead of showing the form', () => {
    auth.user = makeUser();
    const fetchMock = mockFetch({});
    renderAccount();
    expect(
      screen.getByRole('heading', { name: 'You’re signed in, Nimali Perera.' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the sign-in form on My contributions for a signed-out visitor without fetching', () => {
    const fetchMock = mockFetch({});
    renderAccount({ path: '/my-reviews', contributions: true });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists contributions with their moderation status and moderator notes', async () => {
    auth.user = makeUser();
    mockFetch({
      'GET /api/my-postings': {
        body: [
          makePosting({
            id: 1,
            restaurant_name: 'Lagoon Table',
            status: 'pending',
            body: 'Great!',
          }),
          makePosting({
            id: 2,
            restaurant_id: 3,
            restaurant_name: 'Hill Kade',
            kind: 'comment',
            status: 'rejected',
            moderation_reason: 'Off topic',
            body: 'Buy my stuff',
          }),
          makePosting({ id: 3, restaurant_name: 'Fort Cafe', status: 'approved', body: 'Nice.' }),
        ],
      },
    });
    renderAccount({ path: '/my-reviews', contributions: true });

    expect(await screen.findByRole('link', { name: 'Lagoon Table' })).toHaveAttribute(
      'href',
      '/restaurants/1',
    );
    const [pending, rejected, approved] = screen.getAllByRole('article');
    expect(within(pending).getByText('pending')).toHaveClass('status', 'pending');
    expect(within(pending).getByText(/Waiting for moderator approval/)).toBeInTheDocument();
    expect(within(rejected).getByRole('status')).toHaveTextContent('Moderator’s note: Off topic');
    expect(within(rejected).getByRole('link', { name: 'Hill Kade' })).toHaveAttribute(
      'href',
      '/restaurants/3',
    );
    expect(within(approved).queryByText(/Waiting for moderator/)).not.toBeInTheDocument();
    expect(within(approved).queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no contributions yet', async () => {
    auth.user = makeUser();
    mockFetch({ 'GET /api/my-postings': { body: [] } });
    renderAccount({ path: '/my-reviews', contributions: true });
    expect(
      await screen.findByRole('heading', { name: 'Your first review starts with a meal.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a restaurant' })).toHaveAttribute('href', '/');
  });

  it('shows an error when contributions fail to load', async () => {
    auth.user = makeUser();
    mockFetch({ 'GET /api/my-postings': { status: 500, body: { error: 'Database down.' } } });
    renderAccount({ path: '/my-reviews', contributions: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database down.');
  });
});
