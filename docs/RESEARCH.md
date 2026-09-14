# Category and service research

Research checked on **13 September 2026**. These sources inform the category taxonomy and presentation, not the fictional sample restaurants' prices or dietary claims. Older editorial pieces are evidence of cuisine/category terminology, not current availability or pricing.

| Source                                                                                                          | Observation                                                                                            | Specification decision                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [Uber Eats: Cafe on the 5th, Colombo](https://www.ubereats.com/lk/store/cafe-on-the-5th/WvNw41r0SEufnXpd5s6bNQ) | Uses Sri Lankan, Chinese and kottu cuisine labels, with menu-level LKR prices and hopper combinations. | Show distinct cuisine/meal categories and individual LKR menu prices.                               |
| [YAMU: A Taste of Jaffna in Wellawatte](https://www.yamu.lk/trending/a-taste-of-jaffna-in-wellawatte/)          | Describes Jaffna cooking within Colombo, including rice, vegetable sides and meat/seafood.             | Keep Jaffna cuisine separate from restaurant city; use a city filter and menu-level category.       |
| [YAMU: Taste of Asia](https://www.yamu.lk/kamu/taste-of-asia/)                                                  | Covers Sri Lankan, South Indian and Jaffna favourites, including hoppers and kottu.                    | Support several categories within a single restaurant; include Indian and kottu/hoppers categories. |
| [YAMU restaurant coverage](https://www.yamu.lk/)                                                                | Reviews and food guides include local meals and multi-cuisine dining.                                  | Combine restaurant discovery with detailed, category-specific menu browsing and reviews.            |

Final taxonomy: **Rice & curry, Kottu & hoppers, Short eats, Jaffna cuisine, Seafood, Chinese, Indian, Western**. The first four expose locally meaningful meal/cuisine groupings; the remaining four support common broader browsing needs. Each menu item currently has one primary category. Restaurants appear in every category represented by at least one menu item. A future many-to-many category model can represent dishes that cross categories, such as Jaffna seafood.

The budget thresholds are the prototype team's proposed rules, not values claimed to be industry standards. They are explicitly displayed: below LKR 1,000; LKR 1,000–2,500; above LKR 2,500, based on rounded average menu-item price. Samples deliberately span all bands for testing.

Four review dimensions were chosen: **food quality, customer service, value for money, ambience**. “Miscellaneous” is captured in free text rather than a vague numeric score. The four dimensions give users consistent, understandable questions and let the prototype display a useful breakdown.

## Image provenance

The catalog now includes **24 distinct, bundled photographs**: six dining spaces and eighteen food images. The homepage hero reuses the Village rice & curry photograph. Each catalog entry has its own file, verified by content hashes in the test suite.

The machine-readable attribution manifest is [`public/image-credits.json`](../public/image-credits.json). It records the original page, photographer, download URL, licence and modifications for every image. The public **Photo credits** page presents these credits and licence links. Sources include Pexels, Unsplash and Wikimedia Commons; Commons photographs retain their individual CC BY, CC BY-SA, CC0 or public-domain terms. ShareAlike adaptations retain the listed licence. These image licences are separate from the application code.

Photographs are illustrative stock images, not documentary photographs of the fictional venues or exact recipes. Some depict regional equivalents or a selection of short eats. They must not be used to infer ingredients, preparation methods or halal certification. A real catalog should use each restaurant's authorized photographs.

Images are committed under `public/images/`, so normal setup requires no image downloads. `npm run images:download` restores missing files from their recorded source URLs. `npm run db:images` updates the original sample catalog's legacy photos, preserving custom dashboard edits. Image editing accepts HTTPS URLs or restricted bundled `/images/` paths and has an accessible failure fallback.

## Technical references

- [Vite setup guide](https://vite.dev/guide/) — runtime/setup requirements.
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/) — Express 5 route behaviour.
- [PostgreSQL character-set documentation](https://www.postgresql.org/docs/17/multibyte.html) — UTF-8 text support.
- Installed `embedded-postgres` README — launching a local PostgreSQL cluster without Docker.
