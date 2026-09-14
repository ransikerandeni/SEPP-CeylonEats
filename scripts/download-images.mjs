import { readFile, writeFile, stat } from 'node:fs/promises';
const credits = JSON.parse(
  await readFile(new URL('../public/image-credits.json', import.meta.url), 'utf8'),
);
for (const item of credits) {
  const file = new URL(`../public${item.file}`, import.meta.url);
  if (await stat(file).catch(() => null)) continue;
  const response = await fetch(item.imageUrl, {
    headers: { 'User-Agent': 'CeylonEatsEducationalPrototype/0.1 (licensed sample photography)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
    throw new Error(`${item.name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`Invalid image: ${item.name}`);
  await writeFile(file, bytes);
  console.log(`Saved ${item.name} (${Math.round(bytes.length / 1024)} KB)`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
