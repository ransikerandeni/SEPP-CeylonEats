# Prototype test evidence

Verified locally on **14 September 2026**, using Node.js 22.12, PostgreSQL 17.5 and the in-app Chromium browser. The sample data represents fictional businesses.

## Automated verification

`npm test`: **12 tests passed, 0 failed**. The integration suite creates an isolated, uniquely named PostgreSQL schema and drops only that schema afterward. It exercises the real Express routes and PostgreSQL views through HTTP assertions, without changing the application's catalog.

| Area             | Verified behaviour                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog          | Eight categories and all three cities are returned; restaurants without menus remain searchable by name.                                                           |
| Unicode          | English, Sinhala and Tamil names/search/review text round-trip correctly; injection-like search input is treated as text.                                          |
| Filters          | Diet, category and spice filters must match one dish; restaurant price bands use all stored menu prices.                                                           |
| Permissions      | Anonymous writes, customer/staff privilege escalation, unauthorized company responses and cross-origin writes are rejected.                                        |
| Review integrity | Required 1–5 ratings, valid dish/restaurant relationships and own-restaurant review restrictions are enforced.                                                     |
| Moderation       | Pending content is private; review/comment/company response approval is required; unpublishing a parent hides its replies; self-approval is rejected.              |
| Ratings          | Approval changes exact restaurant/dish aggregates; rejection reverses changes; replies do not affect ratings; recommended ordering follows the documented formula. |
| Catalog editing  | Admin creation and Unicode/content/image/price updates persist and create audit entries; dish moves to another restaurant are rejected.                            |
| Price boundaries | LKR 999.99, 1,000, 2,500 and 2,500.01 produce the expected bands.                                                                                                  |
| Sessions         | Public registration cannot assign staff roles; logout invalidates the server session; cookies are HttpOnly and SameSite Strict.                                    |
| Images           | All 24 bundled images are valid, distinct JPEGs with attribution; safe local/HTTPS paths pass while traversal, script, HTTP and protocol-relative paths fail.      |

`npm run build`: TypeScript validation and the production frontend build pass. The main JavaScript bundle is approximately 293 KB (93 KB compressed); staff/detail/credits pages load separately.

`npm run format:check` and `git diff --check`: formatting and whitespace validation pass.

## Browser scenarios

| Scenario            | Observed result                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop discovery   | Restaurant cards, categories, image thumbnails and search controls render correctly.                                                                                              |
| Combined filtering  | Kandy + vegan gives two restaurants and four dishes; ascending price displays 280, 650, 750 and 1,150 LKR.                                                                        |
| Dish navigation     | Opening Vegetable roti leads to its restaurant and selected menu entry, including Sinhala/Tamil names.                                                                            |
| Authentication      | Customer and admin sign-in work with private local sample credentials.                                                                                                            |
| Multilingual review | A review containing Sinhala, Tamil and English submits as pending; public rating/review count stays unchanged until approval.                                                     |
| Staff moderation    | Admin approval publishes the browser-test contribution; unpublishing with a reason restores the sample public count to 18. The test contribution remains private with its reason. |
| Price editing       | Changed Vegetable roti from LKR 280 to 300 through the form, confirmed the saved table value, then restored 280. Local bundled image paths remain valid during edits.             |
| Photography         | All 24 images render on the credits page, with per-photo source and licence links; six restaurant cards use distinct dining photographs.                                          |
| Mobile              | At 390 × 844 the homepage uses a compact navigation and filter layout; document width equals viewport width, without horizontal page overflow.                                    |

## Repeating the checks

1. Start PostgreSQL and configure `.env` as described in the README.
2. Run `npm test`, `npm run build`, and `npm run format:check`.
3. Start the app with `npm run dev` and repeat the browser scenarios using local customer/admin credentials.
4. For a deployment, additionally validate HTTPS cookies/origin settings, backups, concurrency/load, accessibility with assistive technology, browser compatibility and native-speaker translations.

Browser scenarios are manual assisted checks, not a committed automated end-to-end runner. There has been no production penetration test, load test, live deployment or native-speaker language review. These limits do not replace the verified prototype behaviours above.
