import { mkdir, readFile, writeFile } from 'node:fs/promises';
const queries =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [
        'Sri Lanka rice curry',
        'egg hopper',
        'chicken kottu',
        'Sri Lanka vegetable rice curry',
        'Sri Lanka vegetable roti',
        'idiyappam',
        'Sri Lankan fish curry',
        'pepper prawns',
        'fish rice curry',
        'Jaffna crab curry',
        'vegetarian thali',
        'masala dosa',
        'vegetable fried rice',
        'fried cuttlefish',
        'chicken biryani',
        'roasted vegetable bowl',
        'Sri Lankan fish cutlets',
        'mushroom pasta',
      ];
await mkdir('.local', { recursive: true });
const results = JSON.parse(await readFile('.local/image-research.json', 'utf8').catch(() => '[]'));
for (const search of queries) {
  if (results.some((r) => r.search === search)) continue;
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: search + ' filetype:bitmap',
    gsrnamespace: '6',
    gsrlimit: '3',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '900',
  }).toString();
  let response = await fetch(url, {
    headers: { 'User-Agent': 'CeylonEatsEducationalPrototype/0.1 (image attribution research)' },
  });
  for (let retry = 0; response.status === 429 && retry < 3; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    response = await fetch(url, {
      headers: { 'User-Agent': 'CeylonEatsEducationalPrototype/0.1 (image attribution research)' },
    });
  }
  if (!response.ok) throw new Error(`${response.status} while researching ${search}`);
  const data = await response.json();
  results.push({
    search,
    pages: Object.values(data.query?.pages || {}).map((p) => ({
      title: p.title,
      ...p.imageinfo?.[0],
    })),
  });
  console.log(`${search}: ${results.at(-1).pages.length} candidates`);
  await writeFile('.local/image-research.json', JSON.stringify(results, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 2500));
}
await mkdir('.local', { recursive: true });
await writeFile('.local/image-research.json', JSON.stringify(results, null, 2));
