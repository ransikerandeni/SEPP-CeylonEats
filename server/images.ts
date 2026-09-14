import credits from '../public/image-credits.json';
export const sampleImages = credits;
export function sampleImage(name: string, kind: 'dish' | 'restaurant') {
  const image = credits.find((item) => item.name === name && item.kind === kind);
  if (!image) throw new Error(`Missing sample image: ${name}`);
  return image.file;
}
