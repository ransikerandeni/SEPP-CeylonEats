# Ceylon Eats

A restaurant and dish review prototype for Colombo, Kandy and Galle, built with **React + TypeScript**, **Node.js / Express**, and **PostgreSQL**.

The working name is configurable. Sample venues, addresses, prices, reviews, dietary attributes and stock photographs are illustrative, not a directory of verified businesses.

## Run locally

Requires Node.js 22.12+ and npm. Install the locked dependencies:

```sh
npm ci
cp .env.example .env
```

Set `SEED_PASSWORD` in `.env` to a private password of at least 12 characters (at most 72 UTF-8 bytes). This is used only when creating sample accounts. Keep `.env` out of version control.

Choose one PostgreSQL setup:

**Project-local PostgreSQL (no Docker needed):**

```sh
npm run db:local
```

Keep this terminal open. It runs a real PostgreSQL 17.5 server, bound to `127.0.0.1:55432`, and persists its files under ignored `.local/postgres/`. This bundled version is a development convenience; use a maintained PostgreSQL release for deployment. On macOS, local processes must have permission to create shared memory and open loopback ports. For systems where the bundled binary is unsupported, use Docker or your own PostgreSQL instance.

**Docker PostgreSQL:** set `POSTGRES_PASSWORD` in `.env`, update `DATABASE_URL` to match (URL-encode special characters), then:

```sh
docker compose up -d db
```

The Docker and project-local options use the same port. Run only one at a time. Docker uses a persistent named volume.

In a separate terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open [the customer portal](http://127.0.0.1:5173/) or [the staff dashboard](http://127.0.0.1:5173/admin). The API runs on `127.0.0.1:3001`. Seeding is idempotent: it skips existing sample data rather than overwriting edits. Do not run it against a production database.

If this workspace was set up by Codex, `.env` already contains a generated seed password and `.local/ACCESS.md` contains the local sign-in details. Both files are ignored by Git.

| Account                   | Email                       | Access                                              |
| ------------------------- | --------------------------- | --------------------------------------------------- |
| Customer                  | `customer@ceyloneats.test`  | Reviews, comments, own contribution statuses        |
| Restaurant representative | `owner@ceyloneats.test`     | Company responses to assigned restaurants           |
| Moderator                 | `moderator@ceyloneats.test` | Approve, reject, unpublish contributions            |
| Administrator             | `admin@ceyloneats.test`     | Restaurants, menu prices/content/images, moderation |

All seeded accounts use your `SEED_PASSWORD`. Public registration creates customers only. The sample representative is assigned to all six fictional restaurants for demonstrations. Admins can assign an existing owner account when editing a restaurant. Staff provisioning is outside the public registration flow.

## What the prototype does

- Searches restaurant and dish names, including Sinhala and Tamil menu names.
- Browses eight researched categories and all three cities.
- Combines vegetarian, vegan, halal and exact spice-level filters on the **same menu item**.
- Derives restaurant price bands from current database menu prices; no cached or manually assigned price bands.
- Records 1–5 food, service, value and ambience scores. Displays restaurant and dish ratings with review counts.
- Ranks by an explicitly documented Bayesian score, or sorts by raw rating, price or name.
- Queues every review, comment and company response for moderation; pending and rejected posts are never public.
- Allows users to track their own contributions and rejection explanations.
- Provides a protected staff dashboard for restaurant/menu creation, editing and moderation.
- Changes images through validated HTTPS URLs or bundled image paths. An image fallback handles missing or failed images.
- Stores sessions server-side, hashes passwords, checks role/ownership permissions and records staff changes in an audit log.

## Sample photographs

The project includes a different photo for each of the 6 restaurants and 18 dishes, with a public Photo credits page. Files are bundled locally; no image download is needed during setup. For a database seeded by an earlier version, run `npm run db:images` once to replace only the original stock URLs. Custom image edits are preserved. See [image provenance](docs/RESEARCH.md#image-provenance).

## Rename the portal

Change `APP_NAME` in `.env`, restart the API and reload the page. The interface and document title read this setting from `/api/config`, so no frontend rebuild or database migration is needed. Internal package/database names and the request verification header can remain stable.

## Tests and checks

```sh
npm test
npm run build
npm run format:check
```

`npm test` requires PostgreSQL and creates a uniquely named test schema, sets an isolated search path, runs HTTP API assertions, and drops only that schema afterward. It does not truncate or modify the application's sample tables. The configured database user needs `CREATE SCHEMA` permission.

The suite covers authorization, Unicode search/storage, compound filters, exact price-band boundaries, moderation visibility, reply approval, rating mathematics, price edits and audit entries. See [test results and browser scenarios](docs/TESTING.md).

## Production-shaped local build

```sh
npm run build
npm start
```

The Express process serves both the compiled frontend and API at port 3001. For this local HTTP check, set `APP_ORIGIN=http://127.0.0.1:3001` and keep `NODE_ENV=development`. Real deployment should use HTTPS with `NODE_ENV=production` (secure cookies), the exact public `APP_ORIGIN`, a maintained PostgreSQL server, private credentials and backups. The server binds to loopback; place it behind a reverse proxy. A hosting deployment has not been configured or published.

## Project layout

```text
src/                    React pages, shared components, API client and styles
server/                 Express routes, permissions, validation and database access
server/migrations/      Versioned PostgreSQL schema
public/                 24 distinct catalog photos and attribution manifest
scripts/                Local PostgreSQL launcher and image utilities
tests/                  Integration tests against real PostgreSQL
docs/                   Specification, architecture, research, test evidence
```

Read the [specification](docs/SPECIFICATION.md), [architecture](docs/ARCHITECTURE.md), [research](docs/RESEARCH.md) and [contribution guide](CONTRIBUTING.md).

## Version control

The project is initialized on `main` with meaningful milestone commits and a committed `package-lock.json`. Local credentials, database files, dependencies and build outputs are ignored. A remote has not been added because no GitHub/GitLab repository was supplied. Create feature branches and review changes before merging; see `CONTRIBUTING.md`.

## Prototype limits

There is no password recovery, email verification, owner onboarding UI, image upload storage, automatic translation, pagination or production deployment. The interface is English, while user text and menu names support Sinhala/Tamil. Search uses Unicode-aware substring matching, not transliteration or cross-language translation. Halal is a recorded preparation attribute, not a certification claim. Sample translations should receive native-speaker editorial review before use in a real directory.
