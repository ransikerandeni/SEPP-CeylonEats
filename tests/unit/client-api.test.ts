import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, send, money, spiceNames } from '../../src/api';

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('prefixes /api and sends same-origin credentials with the verification headers', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await api('/categories');
    expect(fetchMock).toHaveBeenCalledWith('/api/categories', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CeylonEats' },
    });
  });

  it('merges caller headers and lets them override the defaults', async () => {
    fetchMock.mockResolvedValue(json({}));
    await api('/x', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Extra': '1' } });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'text/plain',
      'X-Requested-With': 'CeylonEats',
      'X-Extra': '1',
    });
  });

  it('does not let the caller downgrade credentials', async () => {
    fetchMock.mockResolvedValue(json({}));
    await api('/x', { credentials: 'include' });
    expect(fetchMock.mock.calls[0][1]!.credentials).toBe('same-origin');
  });

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(json({ user: { id: 1 } }));
    await expect(api('/auth/me')).resolves.toEqual({ user: { id: 1 } });
  });

  it.each([400, 403, 409, 429, 500])(
    'throws the server error message from a JSON %i response',
    async (status) => {
      fetchMock.mockResolvedValue(json({ error: 'Nope from server.' }, status));
      await expect(api('/x')).rejects.toThrow('Nope from server.');
    },
  );

  it('falls back to the generic message for a JSON error without an error field', async () => {
    fetchMock.mockResolvedValue(json({}, 400));
    await expect(api('/x')).rejects.toThrow('Something went wrong. Please try again.');
  });

  it('throws the rate limit message for a plain-text 429', async () => {
    fetchMock.mockResolvedValue(text('Too Many Requests', 429));
    await expect(api('/x')).rejects.toThrow(
      'Too many requests. Please wait a moment and try again.',
    );
  });

  it('throws the generic message for a plain-text 500', async () => {
    fetchMock.mockResolvedValue(text('Bad Gateway', 502));
    await expect(api('/x')).rejects.toThrow('Something went wrong. Please try again.');
  });

  it('throws when a successful response is not JSON', async () => {
    fetchMock.mockResolvedValue(text('<!doctype html>', 200));
    await expect(api('/x')).rejects.toThrow(
      'The server sent an unexpected response. Please try again.',
    );
  });

  it('treats a JSON content type with a charset as JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"a":1}', { headers: { 'Content-Type': 'application/json; charset=utf-8' } }),
    );
    await expect(api('/x')).resolves.toEqual({ a: 1 });
  });
});

describe('send', () => {
  it('builds a request with the method and a JSON body', () => {
    expect(send('PATCH', { status: 'approved' })).toEqual({
      method: 'PATCH',
      body: '{"status":"approved"}',
    });
  });

  it('combines with api to post JSON', async () => {
    fetchMock.mockResolvedValue(json({ id: 3 }, 201));
    await expect(api('/reviews', send('POST', { body: 'Nice' }))).resolves.toEqual({ id: 3 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"body":"Nice"}' });
  });
});

describe('money', () => {
  const lkr = (n: number) =>
    new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);

  it('says there is no menu for a null price', () => {
    expect(money(null)).toBe('No menu yet');
  });

  it.each([
    [1150, '1,150'],
    ['1150.00', '1,150'],
    [1150.5, '1,150.5'],
    ['19.99', '19.99'],
    [1234567.891, '1,234,567.89'],
    [0, '0'],
  ])('formats %j in rupees as %s', (value, digits) => {
    const formatted = money(value);
    expect(formatted).toBe(lkr(Number(value)));
    expect(formatted).toContain(digits);
    expect(formatted).toMatch(/LKR|Rs/);
  });
});

describe('spiceNames', () => {
  it('names each spice level from 0 to 3', () => {
    expect(spiceNames).toHaveLength(4);
    expect(spiceNames[0]).toBe('Not spicy');
    expect(spiceNames[3]).toBe('Hot');
    expect(spiceNames).toEqual(['Not spicy', 'Mild', 'Medium', 'Hot']);
  });
});
