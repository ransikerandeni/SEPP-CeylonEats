export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'CeylonEats',
      ...options.headers,
    },
  });
  // Rate limiters and proxies reply in plain text, so only parse what claims to be JSON.
  const isJson = (response.headers.get('Content-Type') || '').includes('application/json');
  const result = isJson ? await response.json() : null;
  if (!response.ok)
    throw new Error(
      result?.error ||
        (response.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : 'Something went wrong. Please try again.'),
    );
  if (!isJson) throw new Error('The server sent an unexpected response. Please try again.');
  return result;
}
export const send = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export const money = (value: string | number | null) =>
  value === null
    ? 'No menu yet'
    : new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(Number(value));
export const spiceNames = ['Not spicy', 'Mild', 'Medium', 'Hot'];
