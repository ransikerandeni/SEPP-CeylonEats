# Prototype specification

## Purpose and users

Provide a categorized restaurant and dish review portal covering Colombo, Kandy and Galle. Customers discover food, see current LKR prices, and share moderated experiences. Administrators maintain catalog entries; moderators control publication; restaurant representatives respond to their assigned establishments' reviews.

The prototype is a local, database-backed application with a public customer interface and a separate, authenticated `/admin` interface. It is not a delivery or booking system; customer-service ratings can describe booking and on-site experiences.

## Functional requirements and acceptance criteria

| ID  | Requirement                 | Acceptance criterion                                                                                                                                                  |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Cover three cities          | City options are Colombo, Kandy and Galle; stored restaurant city is constrained to these values.                                                                     |
| F02 | Search restaurants and food | English, Sinhala and Tamil substring queries match restaurant or menu names; SQL metacharacters are treated as literal input.                                         |
| F03 | Categorized browsing        | Eight research-informed categories filter dishes and restaurants containing matching dishes.                                                                          |
| F04 | Stored menu prices          | Every dish has a positive, two-decimal LKR amount stored as PostgreSQL `NUMERIC(10,2)`.                                                                               |
| F05 | Dietary/preparation filters | Vegetarian, vegan, halal and spice 0–3 are stored per dish. Combined filters match the same dish. Vegan implies vegetarian.                                           |
| F06 | Restaurant price bands      | Average price of all menu items, rounded to 2 decimal places, determines budget (<1,000), mid (1,000–2,500 inclusive), or premium (>2,500). Empty menus are unpriced. |
| F07 | Multilingual content        | Database UTF-8, Unicode text fields, language-specific name fields and script-capable fonts preserve Sinhala/Tamil/English. No translation is implied.                |
| F08 | Structured reviews          | Authenticated users submit a review with four integer ratings from 1 to 5 and text of 5–4,000 characters; may associate a dish from that restaurant.                  |
| F09 | Comments                    | Authenticated users can comment on an approved root review; comments do not change ratings.                                                                           |
| F10 | Company responses           | The assigned restaurant owner or portal administrator can submit a labelled response to an approved review. Other users cannot impersonate the company.               |
| F11 | Mandatory moderation        | Every new review, comment and response is pending. Only staff can approve/reject; staff cannot moderate their own posts.                                              |
| F12 | Catalog management          | Administrator creates/updates restaurants and menu items, descriptions, translated names, prices, dietary attributes and HTTPS image URLs.                            |
| F13 | Overall ranking             | Public restaurant average uses four equally weighted dimensions. Dish average uses associated food ratings. Recommended order uses the specified Bayesian score.      |
| F14 | Contribution tracking       | Authors can view their own pending/approved/rejected posts, including moderator rejection reasons.                                                                    |
| F15 | Traceability                | Catalog writes and moderation changes record actor, action, entity, timestamp and selected change details in an audit log.                                            |
| F16 | Version control             | Git tracks source, lockfile, migrations and documentation, excluding credentials and local database state.                                                            |

## Detailed business rules

**Menu prices:** prices are individual listed dish prices, not estimated person-level spend or booking charges. A restaurant's average considers its complete menu even when a search filter matches only one dish. Current prices are queried every time, so edits affect listings and price filters immediately. Bands refer to the restaurant average in both restaurant and dish search modes.

**Ratings:** each review's restaurant contribution is `(food + service + value + ambience) / 4`. The restaurant rating is the arithmetic mean across its approved root reviews, including dish-associated reviews. A dish rating is the mean of food-quality scores from approved reviews attached to that dish. Comments and responses carry no rating. Display rounds to one decimal place; calculations preserve precision. New entities show “New”, not a fabricated rating.

**Ranking:** `rank = (n × mean + 5 × 3.5) / (n + 5)`, where `n` is the number of approved reviews. The prior mean is 3.5, with weight 5, to reduce the advantage of one exceptional review. Restaurant and dish ranking each use their relevant score. Recommended sorting uses rank descending, then count, then stable ID. Highest rated uses actual average descending, count, stable ID; unrated items sort last. Price and name sorts also have stable IDs as tie-breakers.

**Moderation:** a moderator may approve a pending/rejected post or reject/unpublish a pending/approved post. Rejection requires an explanation of at least five characters. Child comments/responses are public only when both they and their parent are approved. Unpublishing the parent immediately hides its replies; reapproving the parent restores visibility of independently approved replies. A reply cannot be approved while its parent is unpublished. Staff-authored posts require another staff account's decision.

**Ownership:** a representative can respond only for restaurants whose `owner_id` matches their user ID. Representatives cannot rate their own restaurants. Customer-supplied roles and statuses are ignored; public registration always creates customer accounts. Catalog management is administrator-only; moderators can inspect catalog data while moderating but cannot alter it.

**Text and images:** React displays user text as text, not trusted HTML. Image URLs must be HTTPS or blank. Uploading image files is outside this prototype. A menu's base name may itself contain any supported script; optional Sinhala and Tamil fields also participate in search. Restaurant names are Unicode as well, without separate translated columns.

## Interface design

The discovery screen offers a search field, city selector, category strip, dietary/price/spice filters, result-type tabs and sort control. Restaurant cards expose category, city, average dish price and rating. Dish cards expose names, restaurant, exact price and attributes. Search state is preserved in the URL for browser navigation and sharing.

The detail screen groups menu, community reviews and rating breakdown. Dish-specific links scroll to the matching menu item. Native dialogs contain review/reply forms; form submission shows pending approval rather than adding unapproved content to public reviews.

The staff dashboard has moderation, restaurants and menu/price sections. Moderators see only moderation controls. Validation failures retain the edit dialog. Rejections require a reason. Successful saves reload database-derived results.

The responsive interface uses one-column cards on small screens, an expandable filter panel, native labelled controls, visible keyboard focus, a skip link, native dialog focus management, reduced-motion support, script-specific fonts and fallbacks.

## Non-functional scope

- Server-side validation and database constraints enforce integrity.
- Parameterized SQL protects user-provided query values.
- Session tokens are random, stored hashed in PostgreSQL, and sent via HttpOnly/SameSite cookies.
- Production cookies require HTTPS; unsafe methods require a verification header and allowed origin.
- Rate limiting constrains authentication and general API requests.
- The current dataset is intentionally small; pagination, specialized search indexes and distributed rate limiting are deferred.
- This prototype has been tested locally, not certified for production availability, load, privacy compliance or accessibility conformance.
