import { pool, transaction } from './db';
import { sampleImages } from './images';
// Opt-in migration for the original fictional catalog; preserve custom image edits.
const originalImages = [
  'https://images.unsplash.com/photo-1743674453123-93356ade2891?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1711633648895-f5df0336ff55?auto=format&fit=crop&w=1000&q=85',
  'https://images.pexels.com/photos/5607958/pexels-photo-5607958.jpeg?auto=compress&cs=tinysrgb&w=1000',
];
export async function updateSampleImages() {
  return transaction(async (c) => {
    let count = 0;
    const restaurantNames = sampleImages.filter((i) => i.kind === 'restaurant').map((i) => i.name);
    for (const item of sampleImages) {
      const result =
        item.kind === 'restaurant'
          ? await c.query(
              'UPDATE restaurants SET image_url=$1 WHERE name=$2 AND image_url=ANY($3::text[])',
              [item.file, item.name, originalImages],
            )
          : await c.query(
              'UPDATE menu_items SET image_url=$1 WHERE name=$2 AND image_url=ANY($3::text[]) AND restaurant_id IN (SELECT id FROM restaurants WHERE name=ANY($4::text[]))',
              [item.file, item.name, originalImages, restaurantNames],
            );
      count += result.rowCount || 0;
    }
    return count;
  });
}
if (process.argv[1]?.endsWith('update-images.ts'))
  updateSampleImages()
    .then((count) => console.log(`Updated ${count} sample photos; custom images preserved.`))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
