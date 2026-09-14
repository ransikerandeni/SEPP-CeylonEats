import credits from '../public/image-credits.json';
import { FoodImage } from './components';
export default function PhotoCredits() {
  return (
    <article className="page">
      <span className="eyebrow">Behind the photographs</span>
      <h1>A little credit, where it’s due.</h1>
      <p className="credits-intro">
        Our sample venues and dishes are fictional. These independently sourced photographs
        illustrate food and dining, rather than the exact recipes or locations. Each catalog entry
        uses a different image. Photos are resized at source and cropped to fit; any adaptations of
        ShareAlike images retain their listed licence.
      </p>
      <div className="credits-grid">
        {credits.map((item) => (
          <section className="credit-card" key={item.file}>
            <FoodImage src={item.file} alt={`Illustrative photograph for ${item.name}`} />
            <div>
              <span className="eyebrow">
                {item.kind === 'dish' ? 'On the menu' : 'Dining spaces'}
              </span>
              <h2>{item.name}</h2>
              <p>Photograph by {item.author || 'Unknown photographer'}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Original photograph
              </a>{' '}
              ·{' '}
              <a href={item.licenseUrl} target="_blank" rel="noreferrer">
                {item.license}
              </a>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
